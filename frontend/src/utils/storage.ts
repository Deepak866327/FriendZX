import { AUTH_STORAGE_KEYS } from './constants';

// ── Storage strategy ──────────────────────────────────────────────────────────
//  Access token  → sessionStorage  (tab-isolated; prevents cross-tab user leakage)
//  Refresh token → HttpOnly cookie (set by backend; JS cannot read it)
//  User profile  → sessionStorage  (tab-isolated; non-sensitive display data)
//  Theme         → localStorage    (intentionally shared; not sensitive)
// ─────────────────────────────────────────────────────────────────────────────

export const storage = {
  // ── Access token (short-lived JWT) ─────────────────────────────────────────
  // Kept in sessionStorage so each tab has its own independent token.
  // A cookie-based refresh token is domain-wide; if we refreshed on every page
  // load we'd get whichever account last logged in. By caching the token here
  // per-tab, we only call /refresh when the token is actually expired/missing.
  setToken: (token: string) => {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
  },

  getToken: (): string | null => {
    return sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
  },

  removeToken: () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  },

  // ── User profile ────────────────────────────────────────────────────────────
  setUser: (user: any) => {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
  },

  getUser: (): any => {
    const user = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },

  removeUser: () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER);
  },

  // ── Clear all client-side auth state ───────────────────────────────────────
  // The HttpOnly refresh_token cookie is cleared server-side by /auth/logout.
  clearAuth: () => {
    storage.removeToken();
    storage.removeUser();
  },

  // ── One-time migration cleanup ──────────────────────────────────────────────
  // Before the HttpOnly cookie migration, tokens were stored in localStorage.
  // This runs on every app start and silently removes those stale keys so they
  // don't confuse developers inspecting DevTools Application → Storage.
  clearOldLocalStorage: () => {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
  },

  // ── Generic session helpers ─────────────────────────────────────────────────
  setSessionData: (key: string, value: any) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  getSessionData: (key: string): any => {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  removeSessionData: (key: string) => {
    sessionStorage.removeItem(key);
  },
};
