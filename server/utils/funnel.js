/** Funnel steps in order: landing, every quiz screen, the email wall, results, checkout. */
export const FUNNEL_STEPS = Object.freeze([
  "home",
  "direction",
  "roles",
  "preferences",
  "environment",
  "combat",
  "technical",
  "scores",
  "yom",
  "checkpoint",
  "motivation",
  "review",
  "email",
  "otp",
  "results",
  "checkout",
]);

/** The step from a strict { step } body, or null. */
export function parseFunnelStep(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (Object.keys(body).some((k) => k !== "step")) return null;
  return FUNNEL_STEPS.includes(body.step) ? body.step : null;
}

const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

/** "2026-10-14" in Israel time. */
export function israelDay(date = new Date()) {
  return ISRAEL_DAY.format(date);
}
