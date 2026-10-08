import { migrateLegacyYomHameahTo12 } from "@/lib/yom-hameah-12";
import { createDefaultAssessmentAnswers } from "./defaults";
import {
  COMBAT_PREFERENCE_OPTIONS,
  DAPAR_SCORES,
  ENVIRONMENT_OPTIONS,
  EXIT_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  LEADERSHIP_OPTIONS,
  MEDICAL_PROFILES,
  MOTIVATION_OPTIONS,
  PULL_UP_OPTIONS,
  PUSH_UP_OPTIONS,
  ROLE_AVOIDANCE_OPTIONS,
  ROLE_INTEREST_OPTIONS,
  RUN_3KM_OPTIONS,
  STRESS_OPTIONS,
  TECH_AREA_OPTIONS,
  TECH_LEVEL_OPTIONS,
  COMBAT_READINESS_OPTIONS,
  YOM_SOURCE_OPTIONS,
} from "./options";
import {
  ASSESSMENT_SCHEMA_VERSION,
  type AssessmentAnswers,
  type AssessmentStepId,
  type DaparScore,
  type MedicalProfile,
} from "./types";

export const ASSESSMENT_DRAFT_VERSION = 3 as const;
export const ASSESSMENT_DRAFT_KEY = "kk_personalization_assessment";
export const LEGACY_SIGNUP_DRAFT_KEY = "kk_signup_draft_v1";
export const ASSESSMENT_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AssessmentDraft = {
  draftVersion: typeof ASSESSMENT_DRAFT_VERSION;
  schemaVersion: typeof ASSESSMENT_SCHEMA_VERSION;
  clientDraftId: string;
  currentStep: AssessmentStepId;
  email: string;
  answers: AssessmentAnswers;
  updatedAt: string;
};

const STEP_IDS = new Set<AssessmentStepId>([
  "direction",
  "roles",
  "preferences",
  "environment",
  "style",
  "combat",
  "technical",
  "scores",
  "yom",
  "checkpoint",
  "motivation",
  "identity",
  "review",
  "email",
  "otp",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionSet<T extends string>(options: readonly { value: T }[]): Set<T> {
  return new Set(options.map((option) => option.value));
}

const combatPreferences = optionSet(COMBAT_PREFERENCE_OPTIONS);
const focusPreferences = optionSet(FOCUS_PREFERENCE_OPTIONS);
const fitnessPreferences = optionSet(FITNESS_PREFERENCE_OPTIONS);
const roleInterests = optionSet(ROLE_INTEREST_OPTIONS);
const roleAvoidances = optionSet(ROLE_AVOIDANCE_OPTIONS);
const exitPreferences = optionSet(EXIT_OPTIONS);
const environments = optionSet(ENVIRONMENT_OPTIONS);
const leadershipPreferences = optionSet(LEADERSHIP_OPTIONS);
const stressPreferences = optionSet(STRESS_OPTIONS);
const motivations = optionSet(MOTIVATION_OPTIONS);
const run3kmBands = optionSet(RUN_3KM_OPTIONS);
const pullUpBands = optionSet(PULL_UP_OPTIONS);
const pushUpBands = optionSet(PUSH_UP_OPTIONS);
const combatReadiness = optionSet(COMBAT_READINESS_OPTIONS);
const technicalLevels = optionSet(TECH_LEVEL_OPTIONS);
const technicalAreas = optionSet(TECH_AREA_OPTIONS);
const yomSources = optionSet(YOM_SOURCE_OPTIONS);

function enumOrEmpty<T extends string>(value: unknown, allowed: Set<T>): T | "" {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : "";
}

function enumArray<T extends string>(value: unknown, allowed: Set<T>, max: number): T[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is T => typeof item === "string" && allowed.has(item as T)),
    ),
  ].slice(0, max);
}

function scoreOrUnknownOrNull<T extends number>(
  value: unknown,
  allowed: readonly T[],
): T | "unknown" | null {
  if (value === "unknown") return "unknown";
  const numeric = typeof value === "number" ? value : Number(value);
  return allowed.includes(numeric as T) ? (numeric as T) : null;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const withoutUnsafeControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("");
  return withoutUnsafeControls.slice(0, max);
}

function dateOnly(value: unknown): string {
  const raw = text(value, 32);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

export function normalizeAssessmentAnswers(value: unknown): AssessmentAnswers {
  const source = asRecord(value);
  const defaults = createDefaultAssessmentAnswers();
  const combat = asRecord(source.combatDetails);
  const technical = asRecord(source.technicalDetails);
  const migratedYom = migrateLegacyYomHameahTo12(source.yomHameah);

  return {
    ...defaults,
    preferredName: text(source.preferredName, 120),
    gender: source.gender === "male" || source.gender === "female" ? source.gender : "",
    daparScore: scoreOrUnknownOrNull<DaparScore>(source.daparScore, DAPAR_SCORES),
    medicalProfile: scoreOrUnknownOrNull<MedicalProfile>(source.medicalProfile, MEDICAL_PROFILES),
    draftDate: dateOnly(source.draftDate),
    yomHameah: migratedYom ?? defaults.yomHameah,
    yomHameahSource: enumOrEmpty(source.yomHameahSource, yomSources),
    combatPreference: enumOrEmpty(source.combatPreference, combatPreferences),
    focus: enumOrEmpty(source.focus, focusPreferences),
    physicalActivityLevel: enumOrEmpty(source.physicalActivityLevel, fitnessPreferences),
    rolesInterested: enumArray(source.rolesInterested, roleInterests, 5),
    rolesAvoided: enumArray(source.rolesAvoided, roleAvoidances, 6),
    exitsPreference: enumOrEmpty(source.exitsPreference, exitPreferences),
    environment: enumOrEmpty(source.environment, environments),
    leadership: enumOrEmpty(source.leadership, leadershipPreferences),
    stress: enumOrEmpty(source.stress, stressPreferences),
    motivations: enumArray(source.motivations, motivations, 4),
    combatDetails: {
      run3kmBand: enumOrEmpty(combat.run3kmBand, run3kmBands),
      pullUpsBand: enumOrEmpty(combat.pullUpsBand, pullUpBands),
      pushUpsBand: enumOrEmpty(combat.pushUpsBand, pushUpBands),
      readiness: enumOrEmpty(combat.readiness, combatReadiness),
    },
    technicalDetails: {
      level: enumOrEmpty(technical.level, technicalLevels),
      areas: enumArray(technical.areas, technicalAreas, 4),
    },
    extraNote: text(source.extraNote, 120),
  };
}

function createClientDraftId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function legacyStep(value: unknown): AssessmentStepId {
  const step = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(step) || step <= 1) return "direction";
  if (step <= 3) return "preferences";
  if (step === 4) return "scores";
  if (step === 5) return "yom";
  if (step <= 7) return "identity";
  if (step === 8) return "email";
  return "otp";
}

function validDraftUpdatedAt(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  if (timestamp > now + 5 * 60 * 1000) return null;
  if (now - timestamp > ASSESSMENT_DRAFT_TTL_MS) return null;
  return new Date(timestamp).toISOString();
}

export function createAssessmentDraft(answers = createDefaultAssessmentAnswers()): AssessmentDraft {
  return {
    draftVersion: ASSESSMENT_DRAFT_VERSION,
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    clientDraftId: createClientDraftId(),
    currentStep: "direction",
    email: "",
    answers,
    updatedAt: new Date().toISOString(),
  };
}

export function migrateAssessmentDraft(value: unknown): AssessmentDraft | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) return null;

  if (source.answers && typeof source.answers === "object") {
    const updatedAt = validDraftUpdatedAt(source.updatedAt);
    if (!updatedAt) return null;
    const rawStep = source.currentStep;
    const storedDraftId =
      typeof source.clientDraftId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(source.clientDraftId)
        ? source.clientDraftId
        : createClientDraftId();
    const answers = normalizeAssessmentAnswers(source.answers);
    // Draft v1/v2 preselected "self", so it was not evidence that the user
    // explicitly chose or confirmed a מא"ה source.
    if (Number(source.draftVersion) !== ASSESSMENT_DRAFT_VERSION) {
      answers.yomHameahSource = "";
    }
    return {
      draftVersion: ASSESSMENT_DRAFT_VERSION,
      schemaVersion: ASSESSMENT_SCHEMA_VERSION,
      clientDraftId: storedDraftId,
      currentStep:
        typeof rawStep === "string" && STEP_IDS.has(rawStep as AssessmentStepId)
          ? (rawStep as AssessmentStepId)
          : "direction",
      email: text(source.email, 254).trim().toLowerCase(),
      answers,
      updatedAt,
    };
  }

  // Migration from the original unversioned `kk_signup_draft_v1` shape.
  const answers = normalizeAssessmentAnswers({
    preferredName: source.username,
    gender: source.gender,
    daparScore: source.dapar,
    medicalProfile: source.medical,
    draftDate: source.draftDate,
    yomHameah: source.yomScores,
    combatPreference: source.combatPreference,
    focus: source.focusPref,
    physicalActivityLevel: source.fitnessPref,
  });

  return {
    ...createAssessmentDraft(answers),
    currentStep: legacyStep(source.step),
    email: text(source.email, 254).trim().toLowerCase(),
  };
}

function parseStored(raw: string | null): AssessmentDraft | null {
  if (!raw) return null;
  try {
    return migrateAssessmentDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function loadAssessmentDraft(): AssessmentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const currentRaw = localStorage.getItem(ASSESSMENT_DRAFT_KEY);
    const current = parseStored(currentRaw);
    if (current) return current;
    if (currentRaw) localStorage.removeItem(ASSESSMENT_DRAFT_KEY);
    const legacyRaw = localStorage.getItem(LEGACY_SIGNUP_DRAFT_KEY);
    const legacy = parseStored(legacyRaw);
    if (legacy) saveAssessmentDraft(legacy);
    if (legacyRaw) localStorage.removeItem(LEGACY_SIGNUP_DRAFT_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function saveAssessmentDraft(draft: AssessmentDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      ASSESSMENT_DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Private browsing and storage quotas must not block the assessment.
  }
}

export function clearAssessmentDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ASSESSMENT_DRAFT_KEY);
    localStorage.removeItem(LEGACY_SIGNUP_DRAFT_KEY);
  } catch {
    // Completion already succeeded; storage cleanup is best effort.
  }
}
