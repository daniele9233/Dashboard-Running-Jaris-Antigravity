/// <reference types="vite/client" />
const PUBLIC_RENDER_BACKEND_URL = 'https://dani-backend-ea0s.onrender.com';
const LOCAL_BACKEND_URL = 'http://localhost:8000';

function normaliseBackendUrl(value?: string): string {
  let rawUrl = value?.trim();

  if (!rawUrl) {
    return import.meta.env.DEV ? LOCAL_BACKEND_URL : PUBLIC_RENDER_BACKEND_URL;
  }

  if (!rawUrl.startsWith('http')) {
    rawUrl = `https://${rawUrl}`;
  }

  try {
    const url = new URL(rawUrl);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    // Render's `fromService.property: host` can resolve to an internal host name.
    // A static frontend runs in the user's browser, so it needs the public URL.
    if (!isLocal && (url.hostname === 'dani-backend-ea0s' || !url.hostname.includes('.'))) {
      return PUBLIC_RENDER_BACKEND_URL;
    }

    return url.origin;
  } catch {
    return import.meta.env.DEV ? LOCAL_BACKEND_URL : PUBLIC_RENDER_BACKEND_URL;
  }
}

const BASE_URL = normaliseBackendUrl(import.meta.env.VITE_BACKEND_URL);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  }).catch(async (error) => {
    if (!import.meta.env.DEV && BASE_URL !== PUBLIC_RENDER_BACKEND_URL) {
      return fetch(`${PUBLIC_RENDER_BACKEND_URL}${path}`, {
        ...options,
        headers,
      });
    }
    throw error;
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    let message = text || `${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.detail || parsed.error || message;
      if (typeof message !== 'string') {
        message = JSON.stringify(message);
      }
    } catch {
      // Keep the raw response text when the backend does not return JSON.
    }
    throw new ApiError(res.status, `${res.status}: ${message}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
