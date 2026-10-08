import type { DashboardResponse } from "./api";
import {
  COMBAT_PREFERENCE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  type CombatPreferenceValue,
  type FitnessPreferenceValue,
  type FocusPreferenceValue,
} from "./profile-preference-data";
import { defaultYomHameahScores, migrateLegacyYomHameah, type YomHameah } from "./yom-hameah";

const COMBAT_SET = new Set(COMBAT_PREFERENCE_OPTIONS.map((o) => o.value));
const FOCUS_SET = new Set(FOCUS_PREFERENCE_OPTIONS.map((o) => o.value));
const FITNESS_SET = new Set(FITNESS_PREFERENCE_OPTIONS.map((o) => o.value));

export function draftDateToYmd(raw: string | Date | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function yomFromDashboard(stats: DashboardResponse["stats"]): YomHameah {
  return migrateLegacyYomHameah(stats?.yomHameah) ?? defaultYomHameahScores();
}

export function coerceCombat(v: string | undefined): CombatPreferenceValue | "" {
  if (!v || v === "Undecided") return "";
  return COMBAT_SET.has(v as CombatPreferenceValue) ? (v as CombatPreferenceValue) : "";
}

export function coerceFocus(v: string | undefined): FocusPreferenceValue | "" {
  if (!v || v === "Any") return "";
  return FOCUS_SET.has(v as FocusPreferenceValue) ? (v as FocusPreferenceValue) : "";
}

export function coerceFitness(v: string | undefined): FitnessPreferenceValue | "" {
  if (!v || v === "Unspecified") return "";
  return FITNESS_SET.has(v as FitnessPreferenceValue) ? (v as FitnessPreferenceValue) : "";
}

/** First wizard step that still needs input (1–7). Assumes `!d.aiReady`. */
export function computePostSignupResumeStep(d: DashboardResponse): number {
  const p = d.preferences;
  if (!p?.combatPreference || p.combatPreference === "Undecided") return 1;
  if (!p?.focus || p.focus === "Any") return 2;
  if (!p?.physicalActivityLevel || p.physicalActivityLevel === "Unspecified") return 3;
  if (d.stats?.daparScore == null || d.stats?.medicalProfile == null) return 4;
  if (!migrateLegacyYomHameah(d.stats?.yomHameah)) return 5;
  if (!d.stats?.draftDate || Number.isNaN(Date.parse(String(d.stats.draftDate)))) return 6;
  return 7;
}

/** Primary entry target after the user taps “connect” on marketing pages. */
export function authedEntryHref(d: DashboardResponse | null): "/dashboard" | "/onboarding" | "/post-signup" {
  if (!d) return "/post-signup";
  if (d.aiReady) return "/dashboard";
  if ((d.user?.preferredName ?? "").trim().length > 0) return "/onboarding";
  return "/post-signup";
}
