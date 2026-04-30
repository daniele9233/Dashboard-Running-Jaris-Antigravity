/**
 * AuthContext scaffold (round 8 — #1 multi-tenant prep).
 *
 * STATUS: scaffold, NON attivo. Single-tenant funziona invariato.
 * Quando attivare: vedi `MISSING-PIECES.md` sezione #1.
 *
 * DESIGN parallel a `backend/auth.py`:
 * - `enabled = false` di default → useAuth() ritorna user "default"
 * - Quando flippa true: gestisce login JWT + token storage in localStorage
 *
 * Frontend opt-in: per attivare login flow, mount `<LoginGate>` in App.tsx
 * dopo `<JarvisProvider>` e prima di `<AppContent>`.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { identifyUser } from "../utils/telemetry";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  enabled: boolean;
  loading: boolean;
  /** Login: mock placeholder. Quando attivo: POST /api/auth/login + salva JWT. */
  login: (email: string, password: string) => Promise<void>;
  /** Logout: mock placeholder. Quando attivo: clear JWT + redirect /login. */
  logout: () => Promise<void>;
}

const TOKEN_STORAGE_KEY = "metic:auth-token";

// Feature flag — flippa quando JWT backend è attivo.
// Coerente con `AUTH_ENABLED` env var su backend.
const AUTH_ENABLED = false;

const DEFAULT_USER: AuthUser = { id: "default", name: "Default User" };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    AUTH_ENABLED ? null : DEFAULT_USER,
  );
  const [loading, setLoading] = useState<boolean>(AUTH_ENABLED);

  // Hydration: prova a leggere JWT da localStorage e fetch user info
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    // TODO quando attivo: GET /api/auth/me con Authorization Bearer
    // fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    //   .then(r => r.ok ? r.json() : null)
    //   .then(u => { setUser(u); setLoading(false); });
    setLoading(false);
  }, []);

  // Sentry user context: aggiorna quando user cambia
  useEffect(() => {
    identifyUser(user);
  }, [user]);

  const login = async (email: string, _password: string): Promise<void> => {
    if (!AUTH_ENABLED) {
      console.warn("[auth] AUTH_ENABLED=false, login is no-op");
      return;
    }
    // TODO: POST /api/auth/login → ricevi { token, user } → salva localStorage
    // const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    // const { token, user } = await res.json();
    // localStorage.setItem(TOKEN_STORAGE_KEY, token);
    // setUser(user);
    throw new Error(`Auth not yet activated. login(${email}) is stub.`);
  };

  const logout = async (): Promise<void> => {
    if (!AUTH_ENABLED) return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, enabled: AUTH_ENABLED, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Helper: aggiunge Authorization header al fetch quando AUTH_ENABLED=true.
 *
 * Usage in api/index.ts (TODO future):
 *   const headers = { ...withAuthHeader() };
 *   fetch(url, { headers });
 */
export function withAuthHeader(): Record<string, string> {
  if (!AUTH_ENABLED) return {};
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
