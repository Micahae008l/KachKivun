import crypto from "crypto";
import { TAG_TO_DIMENSIONS } from "./roleCatalogV3.js";

export const SCORING_VERSION = "role-scoring-v3-integrity-2";
export const SCORE_BREAKDOWN_KEYS = [
  "preference",
  "focus",
  "yom",
  "eligibility",
  "catalogQuality",
  "structuredAssessment",
];

/**
 * Deterministic role scoring — the "hybrid" base layer. Produces a stable 0-100
 * basePercent and a focused candidate pool BEFORE the AI ranks/explains. Same
 * profile + same catalog → identical pool + basePercents (the consistency fix).
 * v2 permits a bounded AI nudge; v3 locks ranking and scores before AI copy.
 */

// ── Scoring weights (the tuning surface). Must sum to 1.0 in each mode. ──
// Eligibility (medical/DAPAR) outranks מא"ה — profile gates who can serve where;
// מא"ה only ranks among roles that are already open.
// Catalog data quality is reported in the breakdown but no longer ranks roles: it buried every
// never-validated elite track (תלפיות, סיירת מטכ"ל, טיס) under validated rear roles. Its weight moved to elig.
const W_NORMAL = { pref: 0.28, focus: 0.22, yom: 0.18, elig: 0.32, quality: 0 };
// When מא"ה scores carry no signal (flat/duplicated), move weight off yom.
const W_FLAT_YOM = { pref: 0.34, focus: 0.26, yom: 0.1, elig: 0.3, quality: 0 };
const W_STRUCTURED = {
  pref: 0.2,
  focus: 0.14,
  yom: 0.14,
  elig: 0.27,
  quality: 0,
  assessment: 0.25,
};
const W_STRUCTURED_FLAT_YOM = {
  pref: 0.23,
  focus: 0.17,
  yom: 0.08,
  elig: 0.27,
  quality: 0,
  assessment: 0.25,
};
/** Self-estimated מא"ה: keep weights, but compress yomFit toward neutral (0.5). */
const SELF_YOM_SIGNAL = 0.35;
/** Common line-combat threshold used only for conservative profile notices. */
export const DEFAULT_COMBAT_MEDICAL_FLOOR = 82;
/** Absolute minimum for any combat-flagged role (e.g. combat medic). */
export const ABSOLUTE_COMBAT_MEDICAL_MIN = 64;

const BASE_MIN = 42;
const BASE_SPAN = 52; // basePercent ∈ [42, 94]
const SOFT_FLOOR_MULT = 0.6; // ai_draft floor breach penalty
const ADJ_MIN = -8;
const ADJ_MAX = 8;
const FINAL_MIN = 40;
const FINAL_MAX = 96;

const FOCUS_TO_TAGS = {
  // math/physics/research/intelligence included: תלפיות, שחקים and the אמ"ן tech tracks are "technology" to a teen.
  Tech: ["coding", "software", "cyber", "networks", "it", "data", "ai", "electronics", "hardware", "devops", "qa", "math", "physics", "research", "intelligence"],
  Physical: ["combat", "fitness", "fieldwork", "rescue", "driving", "construction", "mechanics"],
  Research: ["intelligence", "research", "data", "maps", "visual-analysis", "math", "physics", "attention-to-detail"],
  Medical: ["medicine", "emergency", "dentistry", "lab", "biology", "chemistry", "helping-people"],
};

const WANTS_COMBAT = new Set(["Kravi", "FieldCombat", "Mixed"]);
const NO_COMBAT = new Set(["Jobnik", "SupportHQ", "TechTrack", "MedicalInstruction"]);
const MEDICAL_STEPS = [21, 45, 64, 72, 82, 97];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

function optionalMetric(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !value.trim() || value === "unknown") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function sanitizeScoreBreakdown(value) {
  const source = value && typeof value === "object" ? value : {};
  const component = (input) => {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? clampInt(numeric, 0, 100) : 0;
  };
  return {
    preference: component(source.preference),
    focus: component(source.focus),
    yom: component(source.yom),
    eligibility: component(source.eligibility),
    catalogQuality: component(source.catalogQuality),
    structuredAssessment: component(source.structuredAssessment),
  };
}

function scoreBreakdownFromFits({
  preference,
  focus,
  yom,
  eligibility,
  catalogQuality,
  structuredAssessment,
}) {
  return sanitizeScoreBreakdown({
    preference: preference * 100,
    focus: focus * 100,
    yom: yom * 100,
    eligibility: eligibility * 100,
    catalogQuality: catalogQuality * 100,
    structuredAssessment: structuredAssessment * 100,
  });
}

/** Physical activity preference → a 1-5 demand the user is comfortable with. */
const PREF_LEVEL = { Low: 1, Medium: 3, High: 5 };
const TECH_LEVEL = { none: 1, basic: 2, intermediate: 3, advanced: 4, expert: 5 };
const STRESS_LEVEL = { low: 1, moderate: 3, high: 5 };
const COMBAT_READINESS_LEVEL = {
  needs_improvement: 2,
  wants_to_improve: 3,
  ready: 5,
};
const RUN_LEVEL = { over_15: 2, "13_to_15": 3, under_13: 5 };
const PULL_UP_LEVEL = { "0_to_5": 2, "6_to_15": 4, "16_plus": 5 };
const PUSH_UP_LEVEL = { "0_to_30": 2, "31_to_60": 4, "61_plus": 5 };

const sortedUniqueStrings = (value, ignored = new Set()) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string" && !ignored.has(item)))].sort()
    : [];

function normalizedOptionalDetails(value, fields) {
  if (!value || typeof value !== "object") return null;
  const out = {};
  let hasValue = false;
  for (const field of fields) {
    const item = value[field];
    if (field === "areas") {
      const areas = sortedUniqueStrings(item, new Set(["undecided"]));
      if (areas.length) {
        out.areas = areas;
        hasValue = true;
      }
    } else if (typeof item === "string" && item && item !== "unknown") {
      out[field] = item;
      hasValue = true;
    }
  }
  return hasValue ? out : null;
}

/**
 * Canonical structured assessment signals. Array order and duplicates never
 * affect scoring or the profile hash.
 */
export function normalizeAssessmentSignals(input) {
  const source =
    input?.answers ??
    input?.assessmentSignals ??
    input?.assessmentAnswers ??
    input?.assessment ??
    input ??
    {};

  return {
    rolesInterested: sortedUniqueStrings(source.rolesInterested, new Set(["undecided"])),
    rolesAvoided: sortedUniqueStrings(source.rolesAvoided),
    basePreference:
      typeof source.basePreference === "string" ? source.basePreference : "",
    environment: typeof source.environment === "string" ? source.environment : "",
    leadership: typeof source.leadership === "string" ? source.leadership : "",
    stress: typeof source.stress === "string" ? source.stress : "",
    motivations: sortedUniqueStrings(source.motivations, new Set(["unsure"])),
    focusExtra: sortedUniqueStrings(source.focusExtra),
    technicalDetails: normalizedOptionalDetails(source.technicalDetails, ["level", "areas"]),
    combatDetails: normalizedOptionalDetails(source.combatDetails, [
      "run3kmBand",
      "pullUpsBand",
      "pushUpsBand",
      "readiness",
    ]),
  };
}

export function hasStructuredAssessmentSignals(input) {
  const signals = normalizeAssessmentSignals(input);
  return Boolean(
    signals.rolesInterested.length ||
      signals.rolesAvoided.length ||
      (signals.basePreference && signals.basePreference !== "no_preference") ||
      (signals.environment && signals.environment !== "no_preference") ||
      signals.leadership ||
      signals.stress ||
      signals.motivations.length ||
      signals.technicalDetails ||
      signals.combatDetails,
  );
}

/** True when the 12 מא"ה scores are too uniform to carry placement signal. */
export function isFlatYom(yom) {
  if (!yom) return true;
  const vals = Object.values(yom).filter((v) => Number.isFinite(v));
  if (vals.length < 6) return true;
  return new Set(vals).size <= 2;
}

function combatMatch(roleCombat, pref) {
  if (pref === "Mixed") return 0.7;
  const wants = WANTS_COMBAT.has(pref);
  const no = NO_COMBAT.has(pref);
  if (roleCombat && wants) return 1.0;
  if (!roleCombat && no) return 1.0;
  if (!roleCombat && wants) return 0.35;
  if (roleCombat && no) return 0.0;
  return 0.5; // no/unknown preference
}

function physMatch(physicalDemand, physicalActivityLevel) {
  const pref = PREF_LEVEL[physicalActivityLevel];
  if (pref == null) return 0.6;
  return clamp01(1 - Math.abs(physicalDemand - pref) / 4);
}

function focusFit(role, focus) {
  const wanted = FOCUS_TO_TAGS[focus];
  if (!wanted) return 0.5;
  const wantedSet = new Set(wanted);
  const hits = (role.preferenceTags || []).filter((t) => wantedSet.has(t)).length;
  const intensityByFocus = {
    Tech: role.techIntensity,
    Physical: role.physicalDemand,
    Medical: role.peopleIntensity,
    Research: role.techIntensity,
  };
  const intensity = intensityByFocus[focus] ?? 3;
  return clamp01(0.7 * Math.min(1, hits / 3) + 0.3 * (intensity / 5));
}

function yomFit(role, yom) {
  if (!yom) return 0.5;
  let dims = Array.isArray(role.keyDimensions) ? role.keyDimensions : [];
  if (!dims.length) {
    dims = [];
    for (const t of role.preferenceTags || []) for (const d of TAG_TO_DIMENSIONS[t] || []) dims.push(d);
  }
  dims = [...new Set(dims)];
  if (!dims.length) return 0.5;
  const scores = dims.map((d) => yom[d]).filter((v) => Number.isFinite(v));
  if (!scores.length) return 0.5;
  return clamp01(scores.reduce((a, b) => a + b, 0) / scores.length / 5);
}

function medicalStepMargin(medical, floor) {
  if (medical == null) return 0.5;
  if (floor == null) return 0.6;
  if (medical < floor) return 0.15;
  return clamp01(0.5 + (medical - floor) / 60);
}

function eligibilityMargin(role, dapar, medical) {
  // Clearing a known floor is what matters; 10 points above it is already full credit. Without this,
  // a דפ"ר 90 candidate scored 0 on תלפיות (floor 90) and full on roles with no data.
  let daparComp =
    dapar == null
      ? 0.5
      : role.daparFloor == null
        ? 0.65
        : clamp01(0.75 + (dapar - role.daparFloor) / 40);
  const medFloor = effectiveMedicalFloor(role);
  let medComp = medicalStepMargin(medical, medFloor);
  // Elite floors are the bar itself (תלפיות 90, טיס 97): meeting them is full credit, not a thin margin.
  if (role.tier === "elite") {
    if (dapar != null && (role.daparFloor == null || dapar >= role.daparFloor)) daparComp = 1;
    if (medical != null && (medFloor == null || medical >= medFloor)) medComp = 1;
  }
  let margin = 0.5 * daparComp + 0.5 * medComp;
  if (role.competitiveness === "very_high" && daparComp < 0.3) margin *= 0.85;
  return clamp01(margin);
}

function qualityPrior(role) {
  const status = role.enrichment?.status;
  if (status === "verified") return 1.0;
  if (status === "reviewed") return 0.85;
  if (status === "ai_draft") return 0.7;
  switch (role.validationLevel) {
    case "official_public_validated":
      return 1.0;
    case "official_family_validated":
      return 0.85;
    case "seed_normalized":
      return 0.5;
    default:
      return role.validationLevel?.startsWith("official") ? 0.8 : 0.65;
  }
}

function interestFit(role, signals) {
  if (!signals.rolesInterested.length) return null;
  const roleInterests = new Set(role.interestAreas || []);
  if (!roleInterests.size) return null;
  const hits = signals.rolesInterested.filter((interest) => roleInterests.has(interest)).length;
  if (!hits) return 0.2;
  return clamp01(0.7 + 0.3 * (hits / signals.rolesInterested.length));
}

function avoidanceFit(role, signals) {
  if (!signals.rolesAvoided.length) return null;
  const roleAvoidances = new Set(role.avoidanceSignals || []);
  const hits = signals.rolesAvoided.filter((avoidance) => roleAvoidances.has(avoidance)).length;
  return hits ? Math.max(0, 0.15 - (hits - 1) * 0.1) : 0.85;
}

function environmentFit(role, signals) {
  const wanted = signals.environment;
  const actual = role.environment;
  if (!wanted || wanted === "no_preference" || !actual || actual === "unknown") return null;
  if (wanted === actual) return 1;
  if (wanted === "mixed" || actual === "mixed") return 0.7;
  return 0.15;
}

/** בסיס פתוח / סגור: the one leave-related fact mitgaisim publishes per role. Unknown stays neutral. */
function baseFit(role, signals) {
  const wanted = signals.basePreference;
  if (!wanted || wanted === "no_preference" || typeof role.closedBase !== "boolean") return null;
  return (wanted === "closed") === role.closedBase ? 1 : 0.25;
}

function leadershipFit(role, signals) {
  if (!signals.leadership || signals.leadership === "open") return null;
  const leadershipDemand = Number(role.leadershipDemand);
  const teamworkDemand = Number(role.teamworkDemand);
  const hasLeadership =
    role.leadershipDemand != null && Number.isFinite(leadershipDemand);
  const hasTeamwork = role.teamworkDemand != null && Number.isFinite(teamworkDemand);
  if (!hasLeadership && !hasTeamwork) return null;

  if (signals.leadership === "want_lead") {
    return hasLeadership ? clamp01(leadershipDemand / 5) : null;
  }
  if (signals.leadership === "prefer_team") {
    const team = hasTeamwork ? teamworkDemand / 5 : 0.5;
    const lowCommand = hasLeadership ? 1 - Math.max(0, leadershipDemand - 3) / 2 : 0.5;
    return clamp01(0.7 * team + 0.3 * lowCommand);
  }
  return null;
}

function stressFit(role, signals) {
  const wanted = STRESS_LEVEL[signals.stress];
  const demand = Number(role.stressDemand);
  if (!wanted || role.stressDemand == null || !Number.isFinite(demand)) return null;
  return clamp01(1 - Math.abs(demand - wanted) / 4);
}

function motivationFit(role, signals) {
  if (!signals.motivations.length) return null;
  const roleMotivations = new Set(role.motivationSignals || []);
  if (!roleMotivations.size) return null;
  const hits = signals.motivations.filter((motivation) =>
    roleMotivations.has(motivation),
  ).length;
  return hits ? clamp01(0.55 + 0.45 * (hits / signals.motivations.length)) : 0.25;
}

function technicalFit(role, signals) {
  const details = signals.technicalDetails;
  if (!details) return null;
  const demand = Number(role.technicalLevelDemand);
  const roleAreas = new Set(role.technicalAreas || []);
  const hasDemand =
    role.technicalLevelDemand != null && Number.isFinite(demand);
  if (!hasDemand && !roleAreas.size) return null;

  const level = TECH_LEVEL[details.level];
  const levelFit = hasDemand && level
    ? clamp01(1 - Math.max(0, demand - level) / 4)
    : 0.5;
  const areas = details.areas || [];
  const areaFit = areas.length && roleAreas.size
    ? areas.some((area) => roleAreas.has(area))
      ? 1
      : 0.2
    : 0.5;
  return clamp01(0.55 * levelFit + 0.45 * areaFit);
}

function combatDetailsFit(role, signals) {
  const details = signals.combatDetails;
  if (!role.combat || !details) return null;

  const fitnessValues = [
    RUN_LEVEL[details.run3kmBand],
    PULL_UP_LEVEL[details.pullUpsBand],
    PUSH_UP_LEVEL[details.pushUpsBand],
  ].filter(Number.isFinite);
  const fitnessLevel = fitnessValues.length
    ? fitnessValues.reduce((sum, value) => sum + value, 0) / fitnessValues.length
    : null;
  const readinessLevel = COMBAT_READINESS_LEVEL[details.readiness] ?? null;
  const parts = [];

  if (
    fitnessLevel != null &&
    role.combatFitnessDemand != null &&
    Number.isFinite(Number(role.combatFitnessDemand))
  ) {
    parts.push(
      clamp01(1 - Math.max(0, Number(role.combatFitnessDemand) - fitnessLevel) / 4),
    );
  }
  if (
    readinessLevel != null &&
    role.combatReadinessDemand != null &&
    Number.isFinite(Number(role.combatReadinessDemand))
  ) {
    parts.push(
      clamp01(1 - Math.max(0, Number(role.combatReadinessDemand) - readinessLevel) / 4),
    );
  }
  if (!parts.length) return null;
  return parts.reduce((sum, value) => sum + value, 0) / parts.length;
}

/**
 * Structured assessment fit, computed only from signals for which role data is
 * known. Unknown environment/exits/etc. therefore remain neutral.
 */
export function structuredAssessmentFit(role, input) {
  const signals = normalizeAssessmentSignals(input);
  const components = {
    interests: interestFit(role, signals),
    avoidances: avoidanceFit(role, signals),
    environment: environmentFit(role, signals),
    base: baseFit(role, signals),
    leadership: leadershipFit(role, signals),
    stress: stressFit(role, signals),
    motivations: motivationFit(role, signals),
    technical: technicalFit(role, signals),
    combat: combatDetailsFit(role, signals),
  };
  const weights = {
    interests: 0.26,
    avoidances: 0.2,
    environment: 0.1,
    base: 0.08,
    leadership: 0.1,
    stress: 0.1,
    motivations: 0.08,
    technical: 0.06,
    combat: 0.04,
  };

  let total = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(components)) {
    if (value == null || !Number.isFinite(value)) continue;
    total += value * weights[key];
    weight += weights[key];
  }

  return {
    fit: weight ? clamp01(total / weight) : 0.5,
    components,
    signals,
  };
}

const DIM_LABELS_SHORT = {
  technicalActivation: "הפעלה טכנית",
  spatialPerception: "תפיסה מרחבית",
  dataProcessing: "עיבוד מידע",
  teamwork: "עבודת צוות",
  command: "פיקוד",
  instruction: "הדרכה",
  interpersonalCare: "טיפול באדם",
  diligencePersistence: "התמדה",
  managementOrganization: "ניהול וארגון",
  frameworkBehavior: "התנהגות מסגרתית",
  maturity: "בגרות",
};

/** Effective medical floor for scoring/gates. Unknown means no role-specific gate. */
export function effectiveMedicalFloor(role) {
  return role.medicalFloor != null ? role.medicalFloor : null;
}

/**
 * @param {object} role  - a v3-normalized role
 * @param {object} profile - Base profile plus optional assessmentSignals/assessment answers.
 * @returns {{ eligible, hardFailReasons, base01, basePercent, subscores, breakdownHe }}
 */
export function scoreRole(role, profile) {
  const dapar = optionalMetric(profile.daparScore);
  const medical = optionalMetric(profile.medicalProfile);
  const unknownYom = profile.yomSource === "unknown";
  const flat = unknownYom || (profile.yomFlat ?? isFlatYom(profile.yom));
  const selfYom = profile.yomSource === "self";
  const assessmentSignals = normalizeAssessmentSignals(profile);
  const hasStructured = hasStructuredAssessmentSignals(assessmentSignals);
  const W = hasStructured
    ? flat
      ? W_STRUCTURED_FLAT_YOM
      : W_STRUCTURED
    : flat
      ? W_FLAT_YOM
      : W_NORMAL;

  const hardFailReasons = [];
  const medFloor = effectiveMedicalFloor(role);
  const floorsTrusted =
    role.enrichment?.status === "reviewed" ||
    role.enrichment?.status === "verified";
  let softMult = 1;

  // The general combat minimum is a hard gate. Role-specific floors only become
  // hard eligibility when reviewed/verified; inferred and draft data stay soft.
  if (medical != null && role.combat && medical < ABSOLUTE_COMBAT_MEDICAL_MIN) {
    hardFailReasons.push("פרופיל רפואי נמוך מדי לתפקיד קרבי");
  } else if (medical != null && role.combat && medFloor != null && medical < medFloor) {
    if (floorsTrusted) hardFailReasons.push(`פרופיל רפואי מתחת לסף (${medFloor})`);
    else softMult *= SOFT_FLOOR_MULT;
  }

  // Gender is a hard gate only when the catalog/reviewed enrichment explicitly
  // narrows eligibility. Unknown role data is normalized to "all".
  if (profile.gender && role.genderEligibility && role.genderEligibility !== "all") {
    const wanted = profile.gender === "female" ? "female_only" : "male_only";
    if (role.genderEligibility !== wanted) hardFailReasons.push("התפקיד אינו פתוח למגדר הנבחר");
  }

  // Several rear roles cap men at a rear profile ("גברים פרופיל 45-64"); women are uncapped.
  if (profile.gender === "male" && medical != null && role.maleMedicalMax != null && medical > role.maleMedicalMax) {
    if (floorsTrusted) hardFailReasons.push(`מיועד לגברים עם פרופיל עורפי (עד ${role.maleMedicalMax})`);
    else softMult *= SOFT_FLOOR_MULT;
  }

  if (dapar != null && role.daparFloor != null && dapar < role.daparFloor) {
    if (floorsTrusted) hardFailReasons.push(`דפ"ר מתחת לסף (${role.daparFloor})`);
    else softMult *= SOFT_FLOOR_MULT;
  }
  if (
    medical != null &&
    !role.combat &&
    role.medicalFloor != null &&
    medical < role.medicalFloor
  ) {
    if (floorsTrusted) hardFailReasons.push(`פרופיל רפואי מתחת לסף (${role.medicalFloor})`);
    else softMult *= SOFT_FLOOR_MULT;
  }

  const prefFit = 0.6 * combatMatch(role.combat, profile.combatPreference) + 0.4 * physMatch(role.physicalDemand, profile.physicalActivityLevel);
  // A combat role is not "off focus" for someone who asked for combat or a mix of both.
  const wantsAnyCombat = profile.combatPreference === "FieldCombat" || profile.combatPreference === "Mixed";
  const ff = role.combat && wantsAnyCombat ? Math.max(focusFit(role, profile.focus), 0.65) : focusFit(role, profile.focus);
  let yf = yomFit(role, profile.yom);
  if (unknownYom) yf = 0.5;
  else if (selfYom) yf = 0.5 + (yf - 0.5) * SELF_YOM_SIGNAL;
  const em = eligibilityMargin(role, dapar, medical);
  const qp = qualityPrior(role);
  const structured = structuredAssessmentFit(role, assessmentSignals);
  const scoreBreakdown = scoreBreakdownFromFits({
    preference: prefFit,
    focus: ff,
    yom: yf,
    eligibility: em,
    catalogQuality: qp,
    structuredAssessment: structured.fit,
  });

  let base01 =
    W.pref * prefFit +
    W.focus * ff +
    W.yom * yf +
    W.elig * em +
    W.quality * qp +
    (W.assessment || 0) * structured.fit;
  // ponytail: ambition heuristic. A candidate 30+ דפ"ר points above a known floor is over-qualified for
  // that role (×0.93); within 20 points of the floor is right-sized (×1.05). Replace with a learned prior if needed.
  // Elite tracks (סיירות, תלפיות, טיס, שחקים) have low official דפ"ר floors but select the top of the
  // cohort, so they are never "over-qualified for" and get a lift for strong candidates instead.
  let ambitionMult = 1;
  if (role.tier === "elite") {
    if (dapar != null && dapar >= 80) ambitionMult = 1.08;
    else if (dapar != null && dapar < 70) ambitionMult = 0.92;
  } else if (dapar != null && role.daparFloor != null) {
    const over = dapar - role.daparFloor;
    if (over >= 30) ambitionMult = 0.93;
    else if (over >= 0 && over < 20) ambitionMult = 1.05;
  }
  base01 = clamp01(base01 * softMult * ambitionMult);
  const basePercent = BASE_MIN + Math.round(BASE_SPAN * base01);

  // A compact Hebrew rationale line for the AI prompt (not user-facing).
  const topDim = (role.keyDimensions || [])[0];
  const dimNote = !unknownYom && topDim && Number.isFinite(profile.yom?.[topDim])
    ? ` · ${DIM_LABELS_SHORT[topDim] || topDim} ${profile.yom[topDim]}/5`
    : "";
  const assessmentNote = hasStructured
    ? ` · שאלון ${(structured.fit * 100) | 0}`
    : "";
  const yomLabel = unknownYom ? "מא״ה לא ידוע (ניטרלי)" : `מא"ה ${scoreBreakdown.yom}`;
  const breakdownHe = `בסיס ${basePercent}% · העדפה ${scoreBreakdown.preference} · מיקוד ${scoreBreakdown.focus} · ${yomLabel}${assessmentNote}${dimNote}`;

  return {
    eligible: hardFailReasons.length === 0,
    hardFailReasons,
    base01,
    basePercent,
    scoreBreakdown,
    subscores: {
      prefFit,
      focusFit: ff,
      yomFit: yf,
      eligibilityMargin: em,
      qualityPrior: qp,
      assessmentFit: structured.fit,
      assessmentComponents: structured.components,
    },
    breakdownHe,
  };
}

/** Honest Hebrew heads-up about what the profile does/doesn't open. "" if nothing notable. */
export function buildProfileNotice(profile) {
  const dapar = optionalMetric(profile.daparScore);
  const medical = optionalMetric(profile.medicalProfile);
  const notes = [];
  if (dapar == null || medical == null || profile.yomSource === "unknown") {
    const missing = [
      dapar == null ? "דפ״ר" : "",
      medical == null ? "פרופיל רפואי" : "",
      profile.yomSource === "unknown" ? "ציוני מא״ה" : "",
    ].filter(Boolean);
    notes.push(
      `חשוב: לא ניתן לאמת זכאות מלאה משום ש${missing.join(", ")} לא ידועים. הנתונים החסרים אינם נחשבים כאפס ואינם מפעילים חסימת סף, אך ההמלצות אינן הוכחת זכאות ויש לאמת כל תנאי מול צה״ל.`,
    );
  }
  if (medical && medical < ABSOLUTE_COMBAT_MEDICAL_MIN) {
    notes.push(`עם פרופיל רפואי ${medical}, תפקידי לחימה סגורים בפניכם, ולכן ההמלצות מתמקדות בתפקידים עורפיים ותומכי לחימה.`);
  } else if (medical && medical < DEFAULT_COMBAT_MEDICAL_FLOOR) {
    // Official ladder (mitgaisim): 82 = חי"ר, סיירות, הנדסה קרבית; 72 = all other combat; 64 = תומכי לחימה + מעברים.
    notes.push(
      medical >= 72
        ? `עם פרופיל רפואי ${medical}, חי״ר, סיירות והנדסה קרבית (דורשים 82) סגורים בפניכם, אבל שריון, תותחנים, הגנה אווירית, חילוץ והצלה, חי״ר גבולות ומג״ב פתוחים.`
        : `עם פרופיל רפואי ${medical}, תפקידי לחימה מלאה דורשים 72 ומעלה, ופתוחים תומכי לחימה ולוחם מעברים.`,
    );
  }
  if (profile.gender === "female") {
    notes.push("תנאי ההתנדבות והזכאות למסלולי לחימה לנשים משתנים בין מסלולים ויש לאמת אותם בערוצים הרשמיים.");
  }
  if (profile.yomSource === "self") {
    notes.push("ציוני המא״ה שהוזנו הם הערכה עצמית — הם משפיעים פחות על הדירוג מנתונים רשמיים.");
  } else if (profile.yomSource === "unknown") {
    notes.push("ציוני המא״ה הניטרליים הם מצייני מקום בלבד ואינם משפיעים על הדירוג כאות אישי.");
  }
  return notes.join(" ");
}

export function toDisplayPercent(base01) {
  return BASE_MIN + Math.round(BASE_SPAN * clamp01(base01));
}

/** finalPct = clamp(basePercent + clampedAdjustment). */
export function blendPercent(basePercent, aiAdjust) {
  const adj = clampInt(Number(aiAdjust) || 0, ADJ_MIN, ADJ_MAX);
  return Math.max(FINAL_MIN, Math.min(FINAL_MAX, Math.round(basePercent) + adj));
}

/**
 * Deterministically build the candidate pool the AI ranks over.
 * Sort by base01 desc (Hebrew title tie-break), then greedily fill with a
 * per-category cap and a cap on "famous" roles so niche/specific roles get in.
 */
// ---------- personal request → catalog roles ----------

// Synonym groups so a free-text request ("drones", "רחפנים") finds roles named differently (כטמ"ם).
const REQUEST_SYNONYMS = [
  ["רחפן", "רחפנים", "כטמ", "כטב", "מלט", "drone", "drones", "uav", "נשלטות"],
  ["סייבר", "cyber", "האקר", "האקינג", "8200"],
  ["תכנות", "מתכנת", "תוכניתן", "פיתוח", "programming", "coding", "developer"],
  ["טיס", "טייס", "טיסה", "pilot"],
  ["מודיעין", "intelligence"],
  ["חובש", "פרמדיק", "רפואה", "רפואי", "medic"],
  ["שייטת", "חובל", "חובלים", "צוללות", "צוללן", "navy"],
  ["כלבים", "עוקץ"],
  ["הנדסה", "מהנדס", "engineering"],
  ["דאטה", "data", "אנליסט"],
];

// Words that carry no role meaning; matching on them would flood the pool.
const REQUEST_STOPWORDS = new Set([
  "רוצה", "רוצים", "מאוד", "ממש", "משהו", "באמת", "תפקיד", "תפקידים", "שירות", "בצבא", "יכול",
  "אפשר", "להיות", "הייתי", "אוהב", "אוהבת", "מעניין", "מעניינת", "בתחום", "דברים", "לעשות",
  "שלי", "אבל", "גם", "want", "really", "into", "something", "like", "with",
]);

function requestTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/["'״׳`]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Hebrew glues ה/ו/ב/ל/מ/ש/כ to the front of words; allow one such prefix.
function tokenHasTerm(token, term) {
  return token.startsWith(term) || (token.length > term.length && token.slice(1).startsWith(term));
}

/**
 * Terms from a personal request. `group` terms come from a recognised topic (with synonyms) and
 * rank first; `raw` terms are other meaningful words from the request.
 */
export function requestTerms(personalRequest) {
  const tokens = requestTokens(personalRequest);
  const group = new Set();
  for (const synonyms of REQUEST_SYNONYMS) {
    if (tokens.some((token) => synonyms.some((term) => tokenHasTerm(token, term)))) {
      synonyms.forEach((term) => group.add(term));
    }
  }
  const raw = tokens.filter(
    (token) =>
      token.length >= 4 &&
      !REQUEST_STOPWORDS.has(token) &&
      ![...group].some((term) => tokenHasTerm(token, term)),
  );
  return { group: [...group], raw: [...new Set(raw)] };
}

/** Roles whose title, category, tags or day-to-day mention something the request asked for. */
export function requestMatchedRoles(roles, personalRequest, limit = 5) {
  const { group, raw } = requestTerms(personalRequest);
  const hits = (fields, terms) =>
    terms.length > 0 &&
    requestTokens(fields.join(" ")).some((token) => terms.some((term) => tokenHasTerm(token, term)));
  const named = (role, terms) => hits([role.roleTitle, role.category], terms);
  const described = (role, terms) =>
    hits([role.roleTitle, role.category, role.dayToDay, ...(role.preferenceTags || [])], terms);
  // Best first: topic in the role's name, then topic only in its description, then other request words.
  const tiers = [
    roles.filter((role) => named(role, group)),
    roles.filter((role) => described(role, group)),
    roles.filter((role) => described(role, raw)),
  ];
  return [...new Set(tiers.flat())].slice(0, limit);
}

// ---------- admission chance ----------

const TECH_INTEL_RE = /סייבר|מודיעין|תקשוב|מחשב|שחקים|תוכנה|דאטה|נתונים|8200|טכנולוג/;
const CHANCE_LABEL = {
  high: "סיכוי קבלה גבוה",
  medium: "סיכוי קבלה בינוני",
  low: "סיכוי קבלה נמוך",
  unknown: "אי אפשר להעריך סיכוי",
};

/**
 * Rough, explainable estimate of getting into a role: selection competitiveness, דפ"ר margin
 * over the floor, and the reduced tech/intel quotas for men with a combat profile (72+).
 * ponytail: point heuristic, not a statistical model; replace if real acceptance data appears.
 */
export function admissionChance(role, profile) {
  const dapar = typeof profile.daparScore === "number" ? profile.daparScore : null;
  const medical = typeof profile.medicalProfile === "number" ? profile.medicalProfile : null;
  if (dapar == null && medical == null) {
    return { level: "unknown", label: CHANCE_LABEL.unknown, reason: "בלי דפ״ר ופרופיל רפואי אין על מה לבסס הערכה." };
  }
  const reasons = [];
  let points = { low: 1, medium: 0, high: -1, very_high: -2 }[role.competitiveness] ?? 0;
  if (role.competitiveness === "very_high") reasons.push("מיון תחרותי מאוד, מעטים מתקבלים");
  else if (role.competitiveness === "high") reasons.push("מיון תחרותי");
  else if (role.competitiveness === "low") reasons.push("תפקיד שקל יחסית להתקבל אליו");

  const floor = typeof role.daparFloor === "number" ? role.daparFloor : null;
  if (dapar != null && floor != null) {
    const margin = dapar - floor;
    if (margin >= 20) {
      points += 1;
      reasons.push(`הדפ״ר שלכם גבוה ב־${margin} מהסף`);
    } else if (margin < 10) {
      points -= 1;
      reasons.push("הדפ״ר שלכם ממש על הסף");
    }
  }

  const combatDesignatedMale = profile.gender === "male" && medical != null && medical >= 72;
  if (combatDesignatedMale && !role.combat && TECH_INTEL_RE.test(`${role.category} ${role.roleTitle}`)) {
    points -= 1;
    reasons.push(
      "לבעלי פרופיל קרבי המכסות בטכנולוגיה ובמודיעין מצומצמות, ולמיוני מקצועות המחשב נדרשים דפ״ר 80 ו־10 יח״ל טכנולוגיות",
    );
  }

  const level = points >= 1 ? "high" : points <= -2 ? "low" : "medium";
  return { level, label: CHANCE_LABEL[level], reason: reasons.slice(0, 2).join(". ") };
}

/**
 * Match-roles input: every catalog role the profile is eligible for (דפ"ר, profile and gender
 * gates), ordered so the AI reads the personal request's roles first, then by preference score.
 * The first `detailed` entries carry full facts in the prompt; the rest go as one-liners to keep
 * the prompt affordable. The AI chooses the 5 from the whole list.
 */
export function rolesForAi(roles, profile, { detailed = 80 } = {}) {
  const ctx = { ...profile, yomFlat: isFlatYom(profile.yom) };
  const scored = [];
  for (const role of roles) {
    const s = scoreRole(role, ctx);
    if (!s.eligible) continue;
    scored.push({
      ...role,
      _score: s.base01,
      basePercent: s.basePercent,
      breakdownHe: s.breakdownHe,
      scoreBreakdown: s.scoreBreakdown,
      _subscores: s.subscores,
    });
  }
  scored.sort((a, b) => b._score - a._score || compareStableText(a.roleTitle, b.roleTitle));
  const requested = requestMatchedRoles(scored, profile.personalRequest, 40);
  const requestedTitles = new Set(requested.map((r) => r.roleTitle));
  const ordered = [...requested, ...scored.filter((r) => !requestedTitles.has(r.roleTitle))];
  return ordered.map((r, i) => ({
    ...r,
    requestMatch: requestedTitles.has(r.roleTitle) || undefined,
    admissionChance: admissionChance(r, profile),
    detailed: i < detailed,
  }));
}

export function buildCandidatePool(roles, profile, { poolSize = 15, maxPerCategory = 2, requestLimit = 6 } = {}) {
  const yomFlat = isFlatYom(profile.yom);
  const ctx = { ...profile, yomFlat };

  const scored = [];
  for (const role of roles) {
    const s = scoreRole(role, ctx);
    if (!s.eligible) continue;
    scored.push({
      ...role,
      _score: s.base01,
      basePercent: s.basePercent,
      breakdownHe: s.breakdownHe,
      scoreBreakdown: s.scoreBreakdown,
      _subscores: s.subscores,
    });
  }
  scored.sort((a, b) => b._score - a._score || String(a.roleTitle).localeCompare(String(b.roleTitle), "he"));

  const famousCap = Math.max(1, Math.round(poolSize * 0.4));
  const catCount = new Map();
  let famousCount = 0;
  const pool = [];
  const skipped = [];

  for (const r of scored) {
    if (pool.length >= poolSize) break;
    const cat = r.category || "?";
    const overCat = (catCount.get(cat) || 0) >= maxPerCategory;
    const overFamous = r.popularity === "famous" && famousCount >= famousCap;
    if (overCat || overFamous) {
      skipped.push(r);
      continue;
    }
    pool.push(r);
    catCount.set(cat, (catCount.get(cat) || 0) + 1);
    if (r.popularity === "famous") famousCount++;
  }
  // Relax caps only if we couldn't fill the pool from the eligible set.
  for (const r of skipped) {
    if (pool.length >= poolSize) break;
    pool.push(r);
  }
  // The personal request can pull in eligible roles the preference score ranked lower
  // (e.g. "drones" -> כטמ"ם roles), so the AI can actually pick what was asked for.
  const requested = new Set(
    requestMatchedRoles(scored, profile.personalRequest, requestLimit).map((r) => r.roleTitle),
  );
  for (const r of scored) {
    if (requested.has(r.roleTitle) && !pool.some((p) => p.roleTitle === r.roleTitle)) pool.push(r);
  }
  return pool.map((r) => ({
    ...r,
    requestMatch: requested.has(r.roleTitle) || undefined,
    admissionChance: admissionChance(r, profile),
  }));
}

function compareStableText(a, b) {
  const left = String(a || "").normalize("NFKC");
  const right = String(b || "").normalize("NFKC");
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * v3 canonical ranking. Every eligible catalog role is scored, then the exact
 * top N are selected without diversity caps or any AI adjustment.
 */
export function rankRolesV3(roles, profile, { limit = 5 } = {}) {
  const yomFlat = isFlatYom(profile.yom);
  const context = { ...profile, yomFlat };
  const scored = [];

  for (let index = 0; index < (roles || []).length; index++) {
    const role = roles[index];
    const score = scoreRole(role, context);
    if (!score.eligible) continue;
    scored.push({
      ...role,
      _catalogIndex: index,
      _score: score.base01,
      basePercent: score.basePercent,
      breakdownHe: score.breakdownHe,
      scoreBreakdown: score.scoreBreakdown,
      _subscores: score.subscores,
    });
  }

  scored.sort(
    (a, b) =>
      b._score - a._score ||
      compareStableText(a.roleTitle, b.roleTitle) ||
      a._catalogIndex - b._catalogIndex,
  );

  return scored.slice(0, Math.max(0, limit)).map(({ _catalogIndex, ...role }) => role);
}

/** Stable seed for OpenAI from any string. */
export function seedFromString(str) {
  const h = crypto.createHash("sha256").update(String(str)).digest();
  return h.readUInt32BE(0);
}

/**
 * Canonical hash of everything that affects a match result — same hash ⇒ cache hit.
 */
export function computeProfileHash(
  profile,
  catalogVersion,
  promptVersion,
  engineVersion = process.env.AI_MATCH_ENGINE || "v3",
) {
  const canonical = {
    dapar:
      profile.daparScore === "unknown"
        ? "unknown"
        : optionalMetric(profile.daparScore),
    medical:
      profile.medicalProfile === "unknown"
        ? "unknown"
        : optionalMetric(profile.medicalProfile),
    gender: profile.gender || "",
    combat: profile.combatPreference || "",
    focus: profile.focus || "",
    physical: profile.physicalActivityLevel || "",
    yomSource: profile.yomSource || "",
    yom: profile.yom
      ? Object.keys(profile.yom).sort().map((k) => `${k}:${profile.yom[k]}`).join(",")
      : "",
    assessment: normalizeAssessmentSignals(profile),
    request: String(profile.personalRequest || "").trim(),
    catalog: catalogVersion || "",
    prompt: promptVersion || "",
    engine: engineVersion,
    scoring: SCORING_VERSION,
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
