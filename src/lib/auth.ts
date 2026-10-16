/** In-memory access JWT — never persist to localStorage (XSS-stealable). */
const LEGACY_TOKEN_KEY = "kachkivun_token";
const LEGACY_TOKEN_KEY_OLD = "mishlahat_token";
const LEGACY_ROLE_KEY = "kachkivun_role";

export type AuthRole = "user" | "admin";

/** Not a credential: only says a refresh is worth awaiting, so anonymous visitors never wait on it. */
const SESSION_HINT_KEY = "kk-has-session";

let accessToken: string | null = null;
let storedRole: AuthRole | null = null;
let authVersion = 0;
const listeners = new Set<() => void>();

function notify() {
  authVersion += 1;
  for (const listener of listeners) listener();
}

/** Clear legacy keys left from older builds that stored the JWT. */
function scrubLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY_OLD);
    localStorage.removeItem(LEGACY_ROLE_KEY);
  } catch {
    /* private mode */
  }
}

scrubLegacyStorage();

function setSessionHint(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* private mode */
  }
}

/** True when this browser had a session last time (the refresh cookie itself is unreadable). */
export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeAuth(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getAuthVersion(): number {
  return authVersion;
}

export function getToken(): string | null {
  return accessToken;
}

export function getStoredRole(): AuthRole | null {
  return storedRole;
}

export function setToken(token: string) {
  accessToken = token;
  setSessionHint(true);
  scrubLegacyStorage();
  notify();
}

export function setStoredRole(role: AuthRole | undefined) {
  storedRole = role === "admin" || role === "user" ? role : null;
  scrubLegacyStorage();
  notify();
}

/** Save JWT and optional role after OTP verify / refresh. */
export function setAuthSession(token: string, role?: AuthRole) {
  accessToken = token;
  setSessionHint(true);
  storedRole = role === "admin" || role === "user" ? role : null;
  scrubLegacyStorage();
  notify();
}

export function clearToken() {
  accessToken = null;
  storedRole = null;
  setSessionHint(false);
  scrubLegacyStorage();
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("kk-query-cache-v1");
    }
  } catch {
    /* ignore */
  }
  notify();
}

export function isStoredAdmin(): boolean {
  return storedRole === "admin";
}
