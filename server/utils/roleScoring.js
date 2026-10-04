import crypto from "crypto";
import { TAG_TO_DIMENSIONS } from "./roleCatalogV3.js";

/**
 * Deterministic role scoring — the "hybrid" base layer. Produces a stable 0-100
 * basePercent and a focused candidate pool BEFORE the AI ranks/explains. Same
 * profile + same catalog → identical pool + basePercents (the consistency fix).
 * The AI only nudges within ±8 and writes explanations on top.
 */

// ── Scoring weights (the tuning surface). Must sum to 1.0 in each mode. ──
// Eligibility (medical/DAPAR) outranks מא"ה — profile gates who can serve where;
// מא"ה only ranks among roles that are already open.
const W_NORMAL = { pref: 0.28, focus: 0.22, yom: 0.18, elig: 0.22, quality: 0.1 };
// When מא"ה scores carry no signal (flat/duplicated), move weight off yom.
const W_FLAT_YOM = { pref: 0.34, focus: 0.26, yom: 0.1, elig: 0.2, quality: 0.1 };
/** Self-estimated מא"ה: keep weights, but compress yomFit toward neutral (0.5). */
const SELF_YOM_SIGNAL = 0.35;
/** Default medical floor for combat roles with no enriched floor (line infantry / combat corps). */
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
  Tech: ["coding", "software", "cyber", "networks", "it", "data", "ai", "electronics", "hardware", "devops", "qa"],
  Physical: ["combat", "fitness", "fieldwork", "rescue", "driving", "construction", "mechanics"],
  Research: ["intelligence", "research", "data", "maps", "visual-analysis", "math", "physics", "attention-to-detail"],
  Medical: ["medicine", "emergency", "dentistry", "lab", "biology", "chemistry", "helping-people"],
};

const WANTS_COMBAT = new Set(["Kravi", "FieldCombat", "Mixed"]);
const NO_COMBAT = new Set(["Jobnik", "SupportHQ", "TechTrack", "MedicalInstruction"]);
const MEDICAL_STEPS = [21, 45, 64, 72, 82, 97];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

/** Physical activity preference → a 1-5 demand the user is comfortable with. */
const PREF_LEVEL = { Low: 1, Medium: 3, High: 5 };

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
  if (floor == null) return 0.6;
  if (medical < floor) return 0.15;
  return clamp01(0.5 + (medical - floor) / 60);
}

function eligibilityMargin(role, dapar, medical) {
  const daparComp = role.daparFloor == null ? 0.6 : clamp01((dapar - role.daparFloor) / 30);
  const medComp = medicalStepMargin(medical, effectiveMedicalFloor(role));
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

const DIM_LABELS_SHORT = {
  technicalActivation: "הפעלה טכנית",
  spatialPerception: "תפיסה מרחבית",
  dataProcessing: "עיבוד מידע",
  teamwork: "עבודת צוות",
  command: "פיקוד",
  instruction: "הדרכה",
  interpersonalCare: "טיפול באדם",
  diligencePersistence: "התמדה",
  sustainedAttention: "קשב",
  speedAndAccuracy: "דיוק",
  managementOrganization: "ניהול וארגון",
  disciplineMaturity: "משמעת",
};

/** Effective medical floor for scoring/gates. Combat defaults to 82 when unset. */
export function effectiveMedicalFloor(role) {
  if (role.medicalFloor != null) return role.medicalFloor;
  if (role.combat) return DEFAULT_COMBAT_MEDICAL_FLOOR;
  return null;
}

/**
 * @param {object} role  - a v3-normalized role
 * @param {object} profile - { daparScore, medicalProfile, combatPreference, focus, physicalActivityLevel, yom, yomFlat?, yomSource? }
 * @returns {{ eligible, hardFailReasons, base01, basePercent, subscores, breakdownHe }}
 */
export function scoreRole(role, profile) {
  const dapar = Number(profile.daparScore) || 0;
  const medical = Number(profile.medicalProfile) || 0;
  const flat = profile.yomFlat ?? isFlatYom(profile.yom);
  const selfYom = profile.yomSource === "self";
  const W = flat ? W_FLAT_YOM : W_NORMAL;

  const hardFailReasons = [];
  const medFloor = effectiveMedicalFloor(role);

  // Combat eligibility is a hard gate, not a soft score nudge.
  // Absolute floor 64 (combat medic etc.); role floor defaults to 82 for line combat.
  if (role.combat && medical < ABSOLUTE_COMBAT_MEDICAL_MIN) {
    hardFailReasons.push("פרופיל רפואי נמוך מדי לתפקיד קרבי");
  } else if (role.combat && medFloor != null && medical < medFloor) {
    hardFailReasons.push(`פרופיל רפואי מתחת לסף (${medFloor})`);
  }

  // Gender gate (skipped when gender unknown, to not break existing profiles).
  // Line-infantry combat is male_only, so females are gated there; the 82-profile
  // requirement for female-open (mixed) combat is carried by each role's medicalFloor,
  // not a blanket rule that would wrongly block combat medics/drivers at profile 64.
  if (profile.gender && role.genderEligibility && role.genderEligibility !== "all") {
    const wanted = profile.gender === "female" ? "female_only" : "male_only";
    if (role.genderEligibility !== wanted) hardFailReasons.push("התפקיד אינו פתוח למגדר הנבחר");
  }

  // Non-combat floors: hard only when human-reviewed; otherwise soft penalty.
  // Combat medical floors already hard-gated above (including the 82 default).
  const floorsTrusted = role.enrichment?.status === "reviewed" || role.enrichment?.status === "verified";
  let softMult = 1;
  if (role.daparFloor != null && dapar < role.daparFloor) {
    if (floorsTrusted || role.combat) hardFailReasons.push(`דפ"ר מתחת לסף (${role.daparFloor})`);
    else softMult *= SOFT_FLOOR_MULT;
  }
  if (!role.combat && role.medicalFloor != null && medical < role.medicalFloor) {
    if (floorsTrusted) hardFailReasons.push(`פרופיל רפואי מתחת לסף (${role.medicalFloor})`);
    else softMult *= SOFT_FLOOR_MULT;
  }

  const prefFit = 0.6 * combatMatch(role.combat, profile.combatPreference) + 0.4 * physMatch(role.physicalDemand, profile.physicalActivityLevel);
  const ff = focusFit(role, profile.focus);
  let yf = yomFit(role, profile.yom);
  if (selfYom) yf = 0.5 + (yf - 0.5) * SELF_YOM_SIGNAL;
  const em = eligibilityMargin(role, dapar, medical);
  const qp = qualityPrior(role);

  let base01 = W.pref * prefFit + W.focus * ff + W.yom * yf + W.elig * em + W.quality * qp;
  base01 = clamp01(base01 * softMult);
  const basePercent = BASE_MIN + Math.round(BASE_SPAN * base01);

  // A compact Hebrew rationale line for the AI prompt (not user-facing).
  const topDim = (role.keyDimensions || [])[0];
  const dimNote = topDim && Number.isFinite(profile.yom?.[topDim])
    ? ` · ${DIM_LABELS_SHORT[topDim] || topDim} ${profile.yom[topDim]}/5`
    : "";
  const breakdownHe = `בסיס ${basePercent}% · העדפה ${(prefFit * 100) | 0} · מיקוד ${(ff * 100) | 0} · מא"ה ${(yf * 100) | 0}${dimNote}`;

  return {
    eligible: hardFailReasons.length === 0,
    hardFailReasons,
    base01,
    basePercent,
    subscores: { prefFit, focusFit: ff, yomFit: yf, eligibilityMargin: em, qualityPrior: qp },
    breakdownHe,
  };
}

/** Honest Hebrew heads-up about what the profile does/doesn't open. "" if nothing notable. */
export function buildProfileNotice(profile) {
  const medical = Number(profile.medicalProfile) || 0;
  const notes = [];
  if (medical && medical < ABSOLUTE_COMBAT_MEDICAL_MIN) {
    notes.push(`עם פרופיל רפואי ${medical}, תפקידי לחימה סגורים בפניכם — ההמלצות מתמקדות בתפקידים עורפיים ותומכי-לחימה.`);
  } else if (medical && medical < DEFAULT_COMBAT_MEDICAL_FLOOR) {
    notes.push(`עם פרופיל רפואי ${medical}, רוב תפקידי הלחימה (כולל הנדסה קרבית וחי״ר) דורשים פרופיל 82 — ההמלצות מתמקדות בתפקידים שאינם לחימה מלאה, ובמסלולים קרביים שפתוחים לפרופיל שלכם (אם יש).`);
  }
  if (profile.gender === "female") {
    notes.push("שירות קרבי לנשים הוא התנדבותי ומוגבל בעיקר ליחידות מעורבות (דורש פרופיל 82 ומעלה).");
  }
  if (profile.yomSource === "self") {
    notes.push("ציוני המא״ה שהוזנו הם הערכה עצמית — הם משפיעים פחות על הדירוג מנתונים רשמיים.");
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
export function buildCandidatePool(roles, profile, { poolSize = 15, maxPerCategory = 2 } = {}) {
  const yomFlat = isFlatYom(profile.yom);
  const ctx = { ...profile, yomFlat };

  const scored = [];
  for (const role of roles) {
    const s = scoreRole(role, ctx);
    if (!s.eligible) continue;
    scored.push({ ...role, _score: s.base01, basePercent: s.basePercent, breakdownHe: s.breakdownHe, _subscores: s.subscores });
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
  return pool;
}

/** Stable seed for OpenAI from any string. */
export function seedFromString(str) {
  const h = crypto.createHash("sha256").update(String(str)).digest();
  return h.readUInt32BE(0);
}

/**
 * Canonical hash of everything that affects a match result — same hash ⇒ cache hit.
 */
export function computeProfileHash(profile, catalogVersion, promptVersion) {
  const canonical = {
    dapar: Number(profile.daparScore) || 0,
    medical: Number(profile.medicalProfile) || 0,
    gender: profile.gender || "",
    combat: profile.combatPreference || "",
    focus: profile.focus || "",
    physical: profile.physicalActivityLevel || "",
    yomSource: profile.yomSource || "",
    yom: profile.yom
      ? Object.keys(profile.yom).sort().map((k) => `${k}:${profile.yom[k]}`).join(",")
      : "",
    catalog: catalogVersion || "",
    prompt: promptVersion || "",
    engine: process.env.AI_MATCH_ENGINE || "v2",
    // Bump when gate/weight logic changes so old cached matches are not served.
    scoringRev: "combat-floor-82-yom-downweight-v1",
    // Only when given, so profiles without personal answers keep their cached match.
    ...(profile.personal ? { personal: profile.personal } : {}),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
