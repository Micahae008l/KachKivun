/**
 * The signup wizard's screens, in order. Profile questions come first, email/OTP
 * last: cold ad traffic will not hand over an address before seeing what the site
 * does. Renumbering happens here only; the resume logic reads these names.
 */
export const STEP = {
  combat: 1,
  focus: 2,
  fitness: 3,
  motivation: 4,
  strengths: 5,
  environment: 6,
  languages: 7,
  scores: 8,
  yom: 9,
  draft: 10,
  name: 11,
  email: 12,
  code: 13,
} as const;

export const LAST_PROFILE_STEP = STEP.name;
export const TOTAL_STEPS = STEP.code;
export const STEP_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(STEP).map(([name, n]) => [n, name]),
);
