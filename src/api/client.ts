/// <reference types="vite/client" />
let rawUrl = import.meta.env.VITE_BACKEND_URL ?? 'https://dani-backend-ea0s.onrender.com';
if (rawUrl && !rawUrl.startsWith('http')) {
  rawUrl = `https://${rawUrl}`;
}
const BASE_URL = rawUrl;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
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
