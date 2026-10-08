import { isValidYomHameah, migrateLegacyYomHameah } from "./yomHameahKeys.js";

function assessmentAnswers(assessment) {
  const value = assessment?.answers ?? assessment;
  return value && typeof value === "object" ? value : {};
}

function hasKnownThreshold(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Fields required before AI role matching can run meaningfully. */
export function computeAiProfileMissing(stats, preferences, latestAssessment = null) {
  const missing = [];
  const answers = assessmentAnswers(latestAssessment);

  if (!hasKnownThreshold(stats?.daparScore) && answers.daparScore !== "unknown") {
    missing.push("daparScore");
  }
  if (!hasKnownThreshold(stats?.medicalProfile) && answers.medicalProfile !== "unknown") {
    missing.push("medicalProfile");
  }

  const preferenceSource = preferences?.yomHameahSource;
  const explicitUnknownYom =
    preferenceSource === "unknown" && answers.yomHameahSource === "unknown";
  const knownYomSource = preferenceSource === "official" || preferenceSource === "self";
  if (!knownYomSource && !explicitUnknownYom) missing.push("yomHameahSource");
  if (!isYomHameahComplete(stats?.yomHameah)) missing.push("yomHameah");

  if (!stats?.draftDate || Number.isNaN(new Date(stats.draftDate).getTime())) {
    missing.push("draftDate");
  }

  const p = preferences;
  if (!p?.combatPreference || p.combatPreference === "Undecided") {
    missing.push("combatPreference");
  }
  if (!p?.focus || p.focus === "Any") {
    missing.push("focus");
  }
  if (!p?.physicalActivityLevel || p.physicalActivityLevel === "Unspecified") {
    missing.push("physicalActivityLevel");
  }

  return { ready: missing.length === 0, missing };
}

function isYomHameahComplete(y) {
  const migrated = migrateLegacyYomHameah(y);
  return isValidYomHameah(migrated);
}
