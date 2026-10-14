import { apiFetch } from "./api";

export type FunnelStep =
  | "home"
  | "direction"
  | "roles"
  | "preferences"
  | "environment"
  | "combat"
  | "technical"
  | "scores"
  | "yom"
  | "checkpoint"
  | "motivation"
  | "review"
  | "email"
  | "otp"
  | "results"
  | "checkout";

const QUIZ_STEPS = new Set<string>([
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
]);

export const isQuizFunnelStep = (step: string): step is FunnelStep => QUIZ_STEPS.has(step);

/**
 * Count this browser session reaching a funnel step, once per step per session. Anonymous: only
 * the step name is sent (no cookie, no id), so it runs without the analytics consent.
 */
export function markFunnelStep(step: FunnelStep) {
  if (typeof window === "undefined") return;
  const key = `kk_funnel_${step}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: still count, at worst twice.
  }
  void apiFetch("/api/metrics/funnel", {
    method: "POST",
    body: JSON.stringify({ step }),
    skipAuth: true,
    retries: 0,
  }).catch(() => {});
}
