const AUTH_RETURN_KEY = "kachkivun-auth-return";
const ALLOWED_RETURN_TARGETS = new Set(["/checkout", "/cancellation"]);

export type AuthReturnTarget = "/checkout" | "/cancellation";

export function rememberAuthReturnTarget(target: AuthReturnTarget): void {
  if (typeof window === "undefined" || !ALLOWED_RETURN_TARGETS.has(target)) return;
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, target);
  } catch {
    // Storage restrictions must not block authentication.
  }
}

export function consumeAuthReturnTarget(): AuthReturnTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    return ALLOWED_RETURN_TARGETS.has(stored ?? "") ? (stored as AuthReturnTarget) : null;
  } catch {
    return null;
  }
}
