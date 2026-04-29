import { useState, useEffect, useCallback, useRef } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseApiOptions {
  /** Stable string key used to dedupe + cache the response across components.
   *  Same key in different components share the result for `ttl` ms. */
  cacheKey?: string;
  /** Milliseconds before a cached entry is considered stale. Default 60_000. */
  ttl?: number;
  /** Skip the request entirely when false. Returns null/loading=false. */
  enabled?: boolean;
  /** Persist the cache to localStorage so reload mostra subito dato precedente.
   *  Default `true` quando `cacheKey` è presente. */
  persist?: boolean;
  /** Hard expiry per dato persistito (oltre questo viene scartato).
   *  Default 24h. Tra `ttl` e `persistTtl` il dato è "stale" e usato come SWR. */
  persistTtl?: number;
}

interface CacheEntry {
  data: unknown;
  ts: number;
}

// ─── Module-level shared cache ───────────────────────────────────────────────
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

const STORAGE_PREFIX = 'metic:apicache:v1:';
const DEFAULT_TTL = 60_000;
const DEFAULT_PERSIST_TTL = 24 * 60 * 60 * 1000; // 24h
const MAX_PERSIST_BYTES = 500_000; // 500 KB per key — evita di intasare localStorage

function lsRead(key: string): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function lsWrite(key: string, entry: CacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(entry);
    if (json.length > MAX_PERSIST_BYTES) return; // skip payload troppo grossi
    window.localStorage.setItem(STORAGE_PREFIX + key, json);
  } catch {
    /* quota exceeded / privacy mode — ignore */
  }
}

function lsDrop(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

function lsDropAll(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function notify(key: string) {
  const set = subscribers.get(key);
  if (set) for (const cb of set) cb();
}

/** Drop a cache entry; subscribers re-fetch on next render via refetch.
 *  Drop anche da localStorage. */
export function invalidateCache(key?: string) {
  if (!key) {
    responseCache.clear();
    inflight.clear();
    lsDropAll();
    for (const k of subscribers.keys()) notify(k);
    return;
  }
  responseCache.delete(key);
  inflight.delete(key);
  lsDrop(key);
  notify(key);
}

/** Read what's currently cached without subscribing. */
export function peekCache<T>(key: string): T | null {
  const e = responseCache.get(key);
  if (e) return e.data as T;
  // Fallback: prova a leggere da localStorage e idrata memoria
  const persisted = lsRead(key);
  if (persisted) {
    responseCache.set(key, persisted);
    return persisted.data as T;
  }
  return null;
}

/**
 * Cross-tab sync: ascolta cambi storage da ALTRE tab e propaga al cache memory.
 * Una sola registrazione globale per pagina. Niente loop: storage event non si
 * triggera nella tab che ha scritto.
 */
if (typeof window !== 'undefined' && !(window as unknown as { __meticApiCacheSync?: boolean }).__meticApiCacheSync) {
  (window as unknown as { __meticApiCacheSync?: boolean }).__meticApiCacheSync = true;
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
    const cacheKey = e.key.slice(STORAGE_PREFIX.length);
    if (e.newValue === null) {
      responseCache.delete(cacheKey);
      notify(cacheKey);
      return;
    }
    try {
      const parsed = JSON.parse(e.newValue) as CacheEntry;
      if (typeof parsed?.ts === 'number') {
        responseCache.set(cacheKey, parsed);
        notify(cacheKey);
      }
    } catch { /* ignore */ }
  });
}

/**
 * Hook fetch+cache+dedup.
 *
 * Strategy:
 *   1. Mount → seed da memory cache (instant).
 *   2. Memory miss + persist=true → seed da localStorage (instant).
 *   3. Cache fresh (< ttl) → no fetch.
 *   4. Cache stale (ttl < age < persistTtl) → SWR: usa stale + fetch background.
 *   5. Cache miss/expired (age > persistTtl) → fetch foreground (loading=true).
 *
 * Mutazioni → `invalidateCache(key)` cancella memory + localStorage + notifica
 * tutti i subscriber.
 */
export function useApi<T>(
  fn: () => Promise<T>,
  options: UseApiOptions = {},
): ApiState<T> {
  const {
    cacheKey,
    ttl = DEFAULT_TTL,
    enabled = true,
    persist = true,
    persistTtl = DEFAULT_PERSIST_TTL,
  } = options;

  // Hydration: prova memory, poi localStorage (se persist).
  let initialEntry: CacheEntry | null = null;
  if (cacheKey) {
    initialEntry = responseCache.get(cacheKey) ?? null;
    if (!initialEntry && persist) {
      const fromLs = lsRead(cacheKey);
      if (fromLs && Date.now() - fromLs.ts < persistTtl) {
        responseCache.set(cacheKey, fromLs);
        initialEntry = fromLs;
      }
    }
  }
  const fresh = initialEntry !== null && Date.now() - initialEntry.ts < ttl;

  const [data, setData] = useState<T | null>(initialEntry ? (initialEntry.data as T) : null);
  const [loading, setLoading] = useState<boolean>(enabled && initialEntry === null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest fn in a ref — call sites often pass inline arrows
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const fetch = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return () => {};
    }

    // Memory cache hit → eventualmente background-revalidate (SWR)
    if (cacheKey) {
      const hit = responseCache.get(cacheKey);
      if (hit) {
        const age = Date.now() - hit.ts;
        if (age < ttl) {
          setData(hit.data as T);
          setLoading(false);
          setError(null);
          return () => {};
        }
        // Stale ma entro persistTtl → mostra subito + fetch background.
        if (age < persistTtl) {
          setData(hit.data as T);
          setError(null);
          // continua sotto al fetch ma SENZA loading=true (UX: niente spinner)
        }
      }
    }

    let cancelled = false;
    // Solo se non abbiamo dato → loading visibile.
    setLoading((prev) => prev || data === null);
    setError(null);

    // Dedupe in-flight requests with the same key
    let promise: Promise<unknown> | undefined;
    if (cacheKey && inflight.has(cacheKey)) {
      promise = inflight.get(cacheKey);
    } else {
      promise = fnRef.current();
      if (cacheKey) {
        inflight.set(cacheKey, promise);
        promise.finally(() => {
          if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey);
        });
      }
    }

    promise
      .then((res) => {
        if (cancelled) return;
        const entry: CacheEntry = { data: res, ts: Date.now() };
        if (cacheKey) {
          responseCache.set(cacheKey, entry);
          if (persist) lsWrite(cacheKey, entry);
          notify(cacheKey);
        }
        setData(res as T);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err?.message ?? 'Request failed');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ttl, persistTtl, persist, enabled]);

  // Subscribe to invalidations on this key — peers can mutate and we re-render
  useEffect(() => {
    if (!cacheKey) return;
    const sync = () => {
      const hit = responseCache.get(cacheKey);
      if (hit) {
        setData(hit.data as T);
        setLoading(false);
      } else {
        // Cache cleared → trigger a fresh fetch
        fetch();
      }
    };
    let set = subscribers.get(cacheKey);
    if (!set) {
      set = new Set();
      subscribers.set(cacheKey, set);
    }
    set.add(sync);
    return () => {
      set!.delete(sync);
      if (set!.size === 0) subscribers.delete(cacheKey);
    };
  }, [cacheKey, fetch]);

  useEffect(() => {
    const cleanup = fetch();
    return cleanup;
  }, [fetch]);

  // Quando `fresh` cambia perché un altro hook ha popolato la cache prima → noop
  void fresh;

  return { data, loading, error, refetch: fetch };
}
