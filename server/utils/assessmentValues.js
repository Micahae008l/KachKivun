import { YOM_HAMEAH_KEYS } from "./yomHameahKeys.js";

export const ASSESSMENT_SCHEMA_VERSIONS = [1, 2];
export const SERVICE_LIFE_CYCLES = ["pre"];
export const GENDERS = ["male", "female"];
export const DAPAR_SCORES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const MEDICAL_PROFILES = [21, 45, 64, 72, 82, 97];
export const UNKNOWN_ASSESSMENT_VALUE = "unknown";
export const COMBAT_PREFERENCES = [
  "FieldCombat",
  "SupportHQ",
  "TechTrack",
  "MedicalInstruction",
  "Mixed",
];
export const FOCUS_PREFERENCES = ["Tech", "Physical", "Research", "Medical"];
export const FITNESS_LEVELS = ["Low", "Medium", "High"];
export const YOM_SOURCES = ["official", "self", UNKNOWN_ASSESSMENT_VALUE];

export function neutralYomHameahScores() {
  return Object.fromEntries(YOM_HAMEAH_KEYS.map((key) => [key, 3]));
}

export const ROLE_INTERESTS = [
  "cyber",
  "combat",
  "intelligence",
  "technology_engineering",
  "medical",
  "air_force",
  "navy",
  "instruction_education",
  "logistics",
  "undecided",
];

export const ROLE_AVOIDANCES = [
  "kitchen_maintenance",
  "guard_duty_nights",
  "far_from_home",
  "office_only",
  "too_physical",
  "monotonous",
];

export const EXIT_PREFERENCES = [
  "week_on_off",
  "hamshushim",
  "shushim",
  "twelve_two",
  "twenty_one",
  "rare",
  "no_preference",
];
// Legacy: the IDF publishes no יציאות per role, so this is no longer asked. Kept to validate old documents.
// Replaced by BASE_PREFERENCES (בסיס פתוח / סגור), which role pages on mitgaisim do state.
export const BASE_PREFERENCES = ["open", "closed", "no_preference"];
export const ENVIRONMENTS = ["office", "field", "mixed", "no_preference"];
export const LEADERSHIP_PREFERENCES = ["want_lead", "open", "prefer_team"];
export const STRESS_PREFERENCES = ["high", "moderate", "low"];
export const MOTIVATIONS = [
  "contribution",
  "challenge",
  "career",
  "friends_experience",
  "personal_growth",
  "unsure",
];

export const RUN_3KM_BANDS = ["unknown", "over_15", "13_to_15", "under_13"];
export const PULL_UP_BANDS = ["unknown", "0_to_5", "6_to_15", "16_plus"];
export const PUSH_UP_BANDS = ["unknown", "0_to_30", "31_to_60", "61_plus"];
export const COMBAT_READINESS = ["ready", "needs_improvement", "wants_to_improve", "unsure"];

export const TECHNICAL_LEVELS = ["none", "basic", "intermediate", "advanced", "expert"];
export const TECHNICAL_AREAS = [
  "programming",
  "cybersecurity",
  "networks",
  "data_ai",
  "hardware_electronics",
  "undecided",
];

const COMBAT_ROLE_IDS = new Set(["combat"]);
const TECHNICAL_ROLE_IDS = new Set(["cyber", "intelligence", "technology_engineering"]);

export function deriveAssessmentBranches(answers) {
  return {
    wantsCombat:
      answers.combatPreference === "FieldCombat" ||
      answers.combatPreference === "Mixed" ||
      answers.rolesInterested.some((role) => COMBAT_ROLE_IDS.has(role)),
    wantsTechnical:
      answers.combatPreference === "TechTrack" ||
      answers.focus === "Tech" ||
      answers.rolesInterested.some((role) => TECHNICAL_ROLE_IDS.has(role)),
  };
}
