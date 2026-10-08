import {
  isPaywallEnabled,
  normalizeGrowEnvironment,
  normalizePaymentsProvider,
  validatePaymentEnvironment,
} from "../services/payments/config.js";

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

const WEAK_JWT_SECRETS = new Set([
  "secret",
  "password",
  "changeme",
  "jwt_secret",
  "your-secret-key-change-in-production",
  "your-secret-key",
]);

/** Exit if required vars are missing (always enforced). */
export function requireEnv(names) {
  const missing = names.filter((name) => !trimEnv(name));
  if (missing.length === 0) return;
  console.error(`[api] FATAL: missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

/** Reject short / textbook JWT secrets (need ≥256 bits of entropy in practice). */
export function requireStrongJwtSecret() {
  const secret = trimEnv("JWT_SECRET");
  if (!secret) {
    console.error("[api] FATAL: missing required env: JWT_SECRET");
    process.exit(1);
  }
  if (secret.length < 32 || WEAK_JWT_SECRETS.has(secret.toLowerCase())) {
    console.error(
      "[api] FATAL: JWT_SECRET is too weak. Use at least 32 random chars, e.g. openssl rand -base64 32",
    );
    process.exit(1);
  }
}

export function productionEnvironmentErrors(env = process.env) {
  const enabledLiveGrow =
    isPaywallEnabled(env.PAYWALL_ENABLED) &&
    normalizePaymentsProvider(env.PAYMENTS_PROVIDER) === "grow" &&
    normalizeGrowEnvironment(env.GROW_ENV) === "production";
  if (env.NODE_ENV !== "production" && !enabledLiveGrow) return [];
  return validatePaymentEnvironment(env);
}

/** In production, require vars needed for a secure public deploy. */
export function requireProductionEnv() {
  const paymentErrors = productionEnvironmentErrors();
  if (paymentErrors.length > 0) {
    console.error(`[api] FATAL: invalid payment environment: ${paymentErrors.join("; ")}`);
    process.exit(1);
  }
  if (process.env.NODE_ENV !== "production") return;

  requireEnv(["JWT_SECRET", "MONGODB_URI", "OPENAI_API_KEY"]);
  requireStrongJwtSecret();

  if (!trimEnv("FRONTEND_URL") && !trimEnv("ALLOWED_ORIGINS")) {
    console.error("[api] FATAL: set FRONTEND_URL or ALLOWED_ORIGINS in production.");
    process.exit(1);
  }

  if (!trimEnv("ALLOWED_HOSTS")) {
    console.warn(
      "[api] ALLOWED_HOSTS unset — API accepts any Host header. Set ALLOWED_HOSTS=api.kachkivun.com to reject direct Render/IP hostnames.",
    );
  }

}
