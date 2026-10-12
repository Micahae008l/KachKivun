import { migrateLegacyYomHameah } from "./yomHameahKeys.js";
import { normalizeAssessmentSignals } from "./roleScoring.js";

/** The profile every match computation scores against, built from the user's saved answers. */
export function buildProfileForMatch(stats, preferences, latestAssessment) {
  const answers = latestAssessment?.answers;
  return {
    daparScore: stats.daparScore ?? (answers?.daparScore === "unknown" ? "unknown" : null),
    medicalProfile:
      stats.medicalProfile ?? (answers?.medicalProfile === "unknown" ? "unknown" : null),
    gender: stats.gender,
    combatPreference: preferences?.combatPreference,
    focus: preferences?.focus,
    physicalActivityLevel: preferences?.physicalActivityLevel,
    yom: migrateLegacyYomHameah(stats.yomHameah),
    yomSource: preferences?.yomHameahSource || null,
    assessmentSignals: normalizeAssessmentSignals(answers),
    personalRequest: String(answers?.extraNote || "")
      .trim()
      .slice(0, 400),
  };
}
