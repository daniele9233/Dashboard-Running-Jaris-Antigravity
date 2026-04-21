import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
// Inline RGL types (namespace export interop is fragile with `export =`).
export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}
export interface Layouts {
  lg?: Layout[];
  md?: Layout[];
  sm?: Layout[];
  xs?: Layout[];
  xxs?: Layout[];
}
import { getUserLayout, putUserLayout } from "../api";

const STORAGE_KEY = "metic:layout";
const HIDDEN_STORAGE_KEY = "metic:hidden";
const DEBOUNCE_MS = 500;

/**
 * DEFAULT_LAYOUTS — canonical positions for 12 dashboard widgets.
 * Breakpoints: lg=12col, md=6col, sm=1col (mobile stack).
 */
/**
 * DEFAULT_LAYOUTS mirror original static CSS-grid dashboard (pre-interactive).
 * rowHeight=60px. lg=12 cols, md=6, sm=1.
 *
 * Original layout recap:
 *   Row 1-2: status-form (6×2 hero) | vo2max / fatigue (3×2) | previsione / soglia (3×2)
 *   Row 3:   deriva (3×420px) | weekly-km (5×420px) | last-run-map (4×420px)
 *   Row 4:   [next-optimal + hr-zones stack] (3) | fitness-chart (9)
 *   Row 5:   session-logs (12)
 */
export const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "status-form",     x: 0, y:  0, w: 6, h: 7, minW: 4, minH: 5 },
    { i: "vo2max",          x: 6, y:  0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: "previsione-gara", x: 9, y:  0, w: 3, h: 4, minW: 2, minH: 4 },
    { i: "fatigue-atl",     x: 6, y:  3, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "soglia",          x: 9, y:  4, w: 3, h: 3, minW: 2, minH: 3 },
    { i: "deriva",          x: 0, y:  7, w: 3, h: 7, minW: 2, minH: 5 },
    { i: "weekly-km",       x: 3, y:  7, w: 5, h: 7, minW: 3, minH: 5 },
    { i: "last-run-map",    x: 8, y:  7, w: 4, h: 7, minW: 3, minH: 5 },
    { i: "next-optimal",    x: 0, y: 14, w: 3, h: 4, minW: 2, minH: 4 },
    { i: "hr-zones",        x: 0, y: 18, w: 3, h: 3, minW: 2, minH: 3 },
    { i: "fitness-chart",   x: 3, y: 14, w: 5, h: 7, minW: 4, minH: 5 },
    { i: "training-paces",  x: 8, y: 14, w: 4, h: 7, minW: 3, minH: 5 },
    { i: "session-logs",    x: 0, y: 21, w: 12, h: 6, minW: 6, minH: 4 },
  ],
  md: [
    { i: "status-form",     x: 0, y:  0, w: 6, h: 7 },
    { i: "vo2max",          x: 0, y:  7, w: 3, h: 3 },
    { i: "previsione-gara", x: 3, y:  7, w: 3, h: 4 },
    { i: "fatigue-atl",     x: 0, y: 10, w: 3, h: 4 },
    { i: "soglia",          x: 3, y: 11, w: 3, h: 3 },
    { i: "deriva",          x: 0, y: 14, w: 3, h: 7 },
    { i: "weekly-km",       x: 3, y: 14, w: 3, h: 7 },
    { i: "last-run-map",    x: 0, y: 21, w: 6, h: 7 },
    { i: "next-optimal",    x: 0, y: 28, w: 3, h: 4 },
    { i: "hr-zones",        x: 3, y: 28, w: 3, h: 4 },
    { i: "fitness-chart",   x: 0, y: 32, w: 4, h: 7 },
    { i: "training-paces",  x: 4, y: 32, w: 2, h: 7 },
    { i: "session-logs",    x: 0, y: 39, w: 6, h: 6 },
  ],
  sm: [
    { i: "status-form",     x: 0, y:  0, w: 1, h: 7 },
    { i: "vo2max",          x: 0, y:  7, w: 1, h: 3 },
    { i: "previsione-gara", x: 0, y: 10, w: 1, h: 4 },
    { i: "fatigue-atl",     x: 0, y: 14, w: 1, h: 4 },
    { i: "soglia",          x: 0, y: 18, w: 1, h: 3 },
    { i: "deriva",          x: 0, y: 21, w: 1, h: 6 },
    { i: "weekly-km",       x: 0, y: 27, w: 1, h: 7 },
    { i: "last-run-map",    x: 0, y: 34, w: 1, h: 6 },
    { i: "next-optimal",    x: 0, y: 40, w: 1, h: 4 },
    { i: "hr-zones",        x: 0, y: 44, w: 1, h: 4 },
    { i: "fitness-chart",   x: 0, y: 48, w: 1, h: 7 },
    { i: "training-paces",  x: 0, y: 55, w: 1, h: 6 },
    { i: "session-logs",    x: 0, y: 61, w: 1, h: 6 },
  ],
};

interface LayoutContextValue {
  layouts: Layouts;
  ready: boolean;
  onLayoutChange: (current: Layout[], all: Layouts) => void;
  resetLayout: () => void;
  hiddenKeys: string[];
  hideWidget: (key: string) => void;
  restoreWidget: (key: string) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function readLocal(): Layouts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Layouts;
    return null;
  } catch {
    return null;
  }
}

function writeLocal(layouts: Layouts) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    /* quota exceeded / serialization fail — ignore */
  }
}

function readHidden(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return null;
  } catch {
    return null;
  }
}

function writeHidden(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

/**
 * Merge defaults with a stored layout so newly added widget keys appear
 * automatically at default positions instead of disappearing from the grid.
 */
function mergeWithDefaults(stored: Layouts | null | undefined): Layouts {
  if (!stored) return DEFAULT_LAYOUTS;
  const merged: Layouts = {};
  (["lg", "md", "sm"] as const).forEach((bp) => {
    const def = DEFAULT_LAYOUTS[bp] ?? [];
    const storedBp = stored[bp] ?? [];
    const known = new Set(storedBp.map((it) => it.i));
    const missing = def.filter((it) => !known.has(it.i));
    merged[bp] = [...storedBp, ...missing];
  });
  return merged;
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layouts, setLayouts] = useState<Layouts>(() => mergeWithDefaults(readLocal()));
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => readHidden() ?? []);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const latestLayouts = useRef<Layouts>(layouts);
  const latestHidden = useRef<string[]>(hiddenKeys);

  // Hydrate from backend on mount (backend wins over localStorage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getUserLayout();
        if (cancelled) return;
        if (res?.layouts) {
          const merged = mergeWithDefaults(res.layouts as Layouts);
          setLayouts(merged);
          latestLayouts.current = merged;
          writeLocal(merged);
        }
        if (Array.isArray(res?.hidden_keys)) {
          const hk = res.hidden_keys.filter((x: unknown): x is string => typeof x === "string");
          setHiddenKeys(hk);
          latestHidden.current = hk;
          writeHidden(hk);
        }
      } catch {
        /* offline / unauth — keep local */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleBackendSync = useCallback((nextLayouts: Layouts, nextHidden: string[]) => {
    latestLayouts.current = nextLayouts;
    latestHidden.current = nextHidden;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      putUserLayout({
        layouts: latestLayouts.current,
        hidden_keys: latestHidden.current,
      }).catch(() => {
        /* ignore — localStorage already saved */
      });
    }, DEBOUNCE_MS);
  }, []);

  const onLayoutChange = useCallback(
    (_current: Layout[], all: Layouts) => {
      setLayouts(all);
      writeLocal(all);
      scheduleBackendSync(all, latestHidden.current);
    },
    [scheduleBackendSync],
  );

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    setHiddenKeys([]);
    writeLocal(DEFAULT_LAYOUTS);
    writeHidden([]);
    scheduleBackendSync(DEFAULT_LAYOUTS, []);
  }, [scheduleBackendSync]);

  const hideWidget = useCallback(
    (key: string) => {
      setHiddenKeys((prev) => {
        if (prev.includes(key)) return prev;
        const next = [...prev, key];
        writeHidden(next);
        scheduleBackendSync(latestLayouts.current, next);
        return next;
      });
    },
    [scheduleBackendSync],
  );

  const restoreWidget = useCallback(
    (key: string) => {
      setHiddenKeys((prev) => {
        if (!prev.includes(key)) return prev;
        const next = prev.filter((k) => k !== key);
        writeHidden(next);
        scheduleBackendSync(latestLayouts.current, next);
        return next;
      });
    },
    [scheduleBackendSync],
  );

  return (
    <LayoutContext.Provider
      value={{ layouts, ready, onLayoutChange, resetLayout, hiddenKeys, hideWidget, restoreWidget }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used inside LayoutProvider");
  return ctx;
}
