import * as mock from "./mock.js";

/** ₪10 for the top 2 matches, in agorot. */
export const TOP2_PRICE_AGOROT = 1000;

const PROVIDERS = { mock };

/**
 * The configured provider, or null when payments can't run here. `mock` grants
 * without charging, so it is refused in production (as .env.example promises).
 * `grow` lands with Phase 2, once sandbox credentials exist to build it against.
 */
export function getPaymentProvider() {
  const name = String(process.env.PAYMENTS_PROVIDER || "mock").trim();
  if (name === "mock" && process.env.NODE_ENV === "production") return null;

  return PROVIDERS[name] ? { name, ...PROVIDERS[name] } : null;
}
