import "../env.js";
import { isPaywallEnabled } from "../services/payments/config.js";
import { productionEnvironmentErrors } from "../utils/requireEnv.js";

const env = { ...process.env, NODE_ENV: "production" };
const errors = [];

for (const name of ["MONGODB_URI", "JWT_SECRET", "OPENAI_API_KEY"]) {
  if (!String(env[name] || "").trim()) errors.push(`${name} is required`);
}
const jwtSecret = String(env.JWT_SECRET || "").trim();
if (jwtSecret && jwtSecret.length < 32) {
  errors.push("JWT_SECRET must contain at least 32 characters");
}
if (
  !String(env.FRONTEND_URL || "").trim() &&
  !String(env.ALLOWED_ORIGINS || "").trim()
) {
  errors.push("FRONTEND_URL or ALLOWED_ORIGINS is required");
}

errors.push(...productionEnvironmentErrors(env));

if (errors.length) {
  console.error("[production-readiness] BLOCKED");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[production-readiness] READY (${isPaywallEnabled(env.PAYWALL_ENABLED) ? "paywall enabled" : "paywall disabled"})`,
  );
  if (!isPaywallEnabled(env.PAYWALL_ENABLED)) {
    console.log("[production-readiness] Charging is disabled; Grow credentials are not required.");
  }
}
