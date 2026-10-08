import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIdfRoleCatalogParsed } from "./idfRoleCatalog.js";
import { YOM_HAMEAH_12_KEYS } from "./yomHameah12Keys.js";
import {
  EXIT_PREFERENCES,
  MOTIVATIONS,
  ROLE_AVOIDANCES,
  ROLE_INTERESTS,
  TECHNICAL_AREAS,
} from "./assessmentValues.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedOverrides;
/** Web-validated per-role enrichment, keyed by exact roleTitle. Grows over time. */
function loadEnrichmentOverrides() {
  if (cachedOverrides !== undefined) return cachedOverrides;
  try {
    const raw = fs.readFileSync(path.join(__dirname, "../data/role-enrichment-v3.json"), "utf8");
    cachedOverrides = JSON.parse(raw)?.overrides || {};
  } catch {
    cachedOverrides = {};
  }
  return cachedOverrides;
}

/**
 * Schema-v3 loader shim. v3 adds structured per-role fields (floors, day-to-day,
 * intensities, keyDimensions, enrichment status). This module normalizes ANY role
 * — a legacy v2 role or an enriched v3 role — into a complete v3 shape, deriving
 * sensible defaults from the v2 tags/flags when the enriched fields are absent.
 * That lets the scoring engine (roleScoring.js) run on today's v2 catalog and
 * improve automatically as roles get enriched — no code change needed.
 */

const YOM = new Set(YOM_HAMEAH_12_KEYS);

/** preferenceTag → the מא"ה dimensions that role tends to exercise. */
export const TAG_TO_DIMENSIONS = {
  coding: ["technicalActivation", "dataProcessing"],
  software: ["technicalActivation", "dataProcessing"],
  cyber: ["technicalActivation", "dataProcessing", "disciplineMaturity"],
  ai: ["technicalActivation", "dataProcessing"],
  data: ["dataProcessing", "sustainedAttention"],
  it: ["technicalActivation"],
  networks: ["technicalActivation"],
  electronics: ["technicalActivation", "speedAndAccuracy"],
  hardware: ["technicalActivation"],
  mechanics: ["technicalActivation", "spatialPerception"],
  devops: ["technicalActivation", "managementOrganization"],
  qa: ["sustainedAttention", "speedAndAccuracy"],
  intelligence: ["dataProcessing", "sustainedAttention", "disciplineMaturity"],
  research: ["dataProcessing", "diligencePersistence"],
  maps: ["spatialPerception", "dataProcessing"],
  "visual-analysis": ["sustainedAttention", "spatialPerception"],
  math: ["dataProcessing"],
  physics: ["dataProcessing", "technicalActivation"],
  "attention-to-detail": ["sustainedAttention", "speedAndAccuracy"],
  leadership: ["command"],
  teaching: ["instruction"],
  instruction: ["instruction"],
  "helping-people": ["interpersonalCare"],
  welfare: ["interpersonalCare"],
  psychology: ["interpersonalCare", "dataProcessing"],
  hr: ["interpersonalCare", "managementOrganization"],
  interviewing: ["interpersonalCare", "dataProcessing"],
  medicine: ["interpersonalCare", "diligencePersistence"],
  emergency: ["interpersonalCare", "speedAndAccuracy"],
  operations: ["managementOrganization", "sustainedAttention"],
  "war-room": ["sustainedAttention", "managementOrganization"],
  logistics: ["managementOrganization"],
  admin: ["managementOrganization", "dataProcessing"],
  fieldwork: ["spatialPerception"],
  combat: ["spatialPerception", "disciplineMaturity"],
  driving: ["spatialPerception", "speedAndAccuracy"],
  rescue: ["interpersonalCare", "spatialPerception"],
};

const TECH_TAGS = new Set([
  "coding", "software", "cyber", "ai", "data", "it", "networks",
  "electronics", "hardware", "devops", "qa", "physics",
]);
const PEOPLE_TAGS = new Set([
  "helping-people", "welfare", "psychology", "hr", "interviewing",
  "medicine", "emergency", "teaching", "instruction",
]);
const FIELD_TAGS = new Set([
  "combat", "fieldwork", "fitness", "rescue", "construction", "driving",
]);
const OFFICE_TAGS = new Set([
  "coding", "software", "cyber", "data", "ai", "research", "admin", "hr",
  "psychology", "interviewing", "writing", "content", "design",
]);
const HIGH_STRESS_TAGS = new Set(["combat", "emergency", "war-room", "operations", "rescue"]);
const VALID_ROLE_INTERESTS = new Set(ROLE_INTERESTS.filter((value) => value !== "undecided"));
const VALID_ROLE_AVOIDANCES = new Set(ROLE_AVOIDANCES);
const VALID_EXIT_PATTERNS = new Set(EXIT_PREFERENCES.filter((value) => value !== "no_preference"));
const VALID_MOTIVATIONS = new Set(MOTIVATIONS.filter((value) => value !== "unsure"));
const VALID_TECHNICAL_AREAS = new Set(TECHNICAL_AREAS.filter((value) => value !== "undecided"));

const INTEREST_TAGS = {
  cyber: new Set(["cyber"]),
  combat: new Set(["combat", "fitness", "fieldwork"]),
  intelligence: new Set(["intelligence", "research", "languages", "arabic", "maps", "visual-analysis"]),
  technology_engineering: new Set([
    "coding", "software", "qa", "devops", "networks", "it", "data", "ai",
    "electronics", "hardware", "mechanics", "physics",
  ]),
  medical: new Set(["medicine", "emergency", "dentistry", "lab", "biology", "helping-people"]),
  air_force: new Set(["aviation", "drones"]),
  navy: new Set(["sea"]),
  instruction_education: new Set(["teaching", "instruction", "public-speaking"]),
  logistics: new Set(["logistics", "driving", "admin", "budget"]),
};

const TECHNICAL_AREA_TAGS = {
  programming: new Set(["coding", "software", "devops", "qa"]),
  cybersecurity: new Set(["cyber"]),
  networks: new Set(["networks", "it"]),
  data_ai: new Set(["data", "ai"]),
  hardware_electronics: new Set(["hardware", "electronics", "mechanics"]),
};

function clampInt(n, lo, hi, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Derive 2-4 key מא"ה dimensions from preference tags (fallback when not enriched). */
export function deriveKeyDimensions(tags = []) {
  const counts = new Map();
  for (const t of tags) {
    for (const dim of TAG_TO_DIMENSIONS[t] || []) {
      counts.set(dim, (counts.get(dim) || 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  return ranked.slice(0, 4);
}

function deriveTechIntensity(tags = []) {
  const hits = tags.filter((t) => TECH_TAGS.has(t)).length;
  return clampInt(1 + hits * 1.3, 1, 5, 2);
}

function derivePeopleIntensity(tags = []) {
  const hits = tags.filter((t) => PEOPLE_TAGS.has(t)).length;
  return clampInt(1 + hits * 1.5, 1, 5, 2);
}

function normalizedEnumArray(value, allowed) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  return [...new Set(values.filter((item) => allowed.has(item)))].sort();
}

function deriveInterestAreas(tags) {
  const tagSet = new Set(tags);
  return Object.entries(INTEREST_TAGS)
    .filter(([, mappedTags]) => [...mappedTags].some((tag) => tagSet.has(tag)))
    .map(([interest]) => interest)
    .filter((interest) => VALID_ROLE_INTERESTS.has(interest))
    .sort();
}

function deriveTechnicalAreas(tags) {
  const tagSet = new Set(tags);
  return Object.entries(TECHNICAL_AREA_TAGS)
    .filter(([, mappedTags]) => [...mappedTags].some((tag) => tagSet.has(tag)))
    .map(([area]) => area)
    .filter((area) => VALID_TECHNICAL_AREAS.has(area))
    .sort();
}

function deriveEnvironment(role, tags, physicalDemand) {
  if (["office", "field", "mixed"].includes(role.environment)) return role.environment;
  if (["office", "field", "mixed"].includes(role.workEnvironment)) return role.workEnvironment;

  const hasFieldSignal =
    Boolean(role.combat) ||
    physicalDemand >= 4 ||
    tags.some((tag) => FIELD_TAGS.has(tag));
  const hasOfficeSignal = tags.some((tag) => OFFICE_TAGS.has(tag));
  if (hasFieldSignal && hasOfficeSignal) return "mixed";
  if (hasFieldSignal) return "field";
  if (hasOfficeSignal && physicalDemand <= 2) return "office";
  return "unknown";
}

function deriveAvoidanceSignals(role, tags, physicalDemand, environment) {
  const signals = new Set(
    normalizedEnumArray(role.avoidanceSignals, VALID_ROLE_AVOIDANCES),
  );
  const title = String(role.roleTitle || "");

  if (environment === "office") signals.add("office_only");
  if (physicalDemand >= 4) signals.add("too_physical");
  if (/(?:טבח|מטבח|אחזקה|תחזוקה)/.test(title)) signals.add("kitchen_maintenance");
  if (role.hasNightDuty === true || role.nightDuty === true) signals.add("guard_duty_nights");
  if (role.closedBase === true || role.remotePosting === true) signals.add("far_from_home");
  if (Number(role.monotonyLevel) >= 4) signals.add("monotonous");

  return [...signals].filter((signal) => VALID_ROLE_AVOIDANCES.has(signal)).sort();
}

function deriveMotivationSignals(role, tags, keyDimensions) {
  const explicit = normalizedEnumArray(role.motivationSignals, VALID_MOTIVATIONS);
  if (explicit.length) return explicit;

  const tagSet = new Set(tags);
  const signals = new Set();
  if (
    ["helping-people", "welfare", "medicine", "emergency", "rescue"].some((tag) =>
      tagSet.has(tag),
    )
  ) {
    signals.add("contribution");
  }
  if (
    role.combat ||
    role.selective ||
    ["cyber", "research", "intelligence"].some((tag) => tagSet.has(tag))
  ) {
    signals.add("challenge");
  }
  if (
    ["coding", "software", "cyber", "data", "ai", "electronics", "hardware", "medicine"].some(
      (tag) => tagSet.has(tag),
    )
  ) {
    signals.add("career");
  }
  if (role.combat || keyDimensions.includes("teamwork")) signals.add("friends_experience");
  if (
    tagSet.has("leadership") ||
    tagSet.has("teaching") ||
    keyDimensions.includes("command")
  ) {
    signals.add("personal_growth");
  }
  return [...signals].filter((signal) => VALID_MOTIVATIONS.has(signal)).sort();
}

// Unknown eligibility must never become a hard gate. Only explicit catalog or
// reviewed enrichment data may narrow gender eligibility.
function deriveGenderEligibility() {
  return "all";
}

const VALID_GENDER_ELIG = new Set(["all", "male_only", "female_only"]);
const VALID_COMPETITIVENESS = new Set(["low", "medium", "high", "very_high"]);
const VALID_POPULARITY = new Set(["famous", "known", "niche"]);
const VALID_TIER = new Set(["elite", "standard"]);
const VALID_ENRICH_STATUS = new Set(["none", "ai_draft", "reviewed", "verified"]);
const VALID_DAPAR = new Set([10, 20, 30, 40, 50, 60, 70, 80, 90]);
const VALID_MEDICAL = new Set([21, 45, 64, 72, 82, 97]);

function pickEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

/** Fill a complete v3 shape from any role (v2 or partially/fully enriched). Non-mutating. */
export function normalizeRoleV3(role) {
  const tags = Array.isArray(role.preferenceTags) ? role.preferenceTags : [];
  const enrichment = role.enrichment && typeof role.enrichment === "object" ? role.enrichment : {};

  const keyDimensions = Array.isArray(role.keyDimensions)
    ? role.keyDimensions.filter((d) => YOM.has(d)).slice(0, 4)
    : [];
  const normalizedKeyDimensions = keyDimensions.length
    ? keyDimensions
    : deriveKeyDimensions(tags);
  const physicalDemand = clampInt(role.physicalDemand, 1, 5, role.combat ? 4 : 2);
  const techIntensity = clampInt(role.techIntensity, 1, 5, deriveTechIntensity(tags));
  const peopleIntensity = clampInt(role.peopleIntensity, 1, 5, derivePeopleIntensity(tags));
  const environment = deriveEnvironment(role, tags, physicalDemand);
  const interestAreas =
    normalizedEnumArray(role.interestAreas, VALID_ROLE_INTERESTS).length > 0
      ? normalizedEnumArray(role.interestAreas, VALID_ROLE_INTERESTS)
      : deriveInterestAreas(tags);
  const technicalAreas =
    normalizedEnumArray(role.technicalAreas, VALID_TECHNICAL_AREAS).length > 0
      ? normalizedEnumArray(role.technicalAreas, VALID_TECHNICAL_AREAS)
      : deriveTechnicalAreas(tags);
  const hasTechnicalSignal = technicalAreas.length > 0 || techIntensity >= 4;
  const leadershipDemand =
    role.leadershipDemand != null && Number.isFinite(Number(role.leadershipDemand))
    ? clampInt(role.leadershipDemand, 1, 5, null)
    : tags.includes("leadership") || normalizedKeyDimensions.includes("command")
      ? 4
      : null;
  const teamworkDemand =
    role.teamworkDemand != null && Number.isFinite(Number(role.teamworkDemand))
    ? clampInt(role.teamworkDemand, 1, 5, null)
    : normalizedKeyDimensions.includes("teamwork") || role.combat
      ? 4
      : null;
  const stressDemand =
    role.stressDemand != null && Number.isFinite(Number(role.stressDemand))
    ? clampInt(role.stressDemand, 1, 5, null)
    : role.combat
      ? 5
      : tags.some((tag) => HIGH_STRESS_TAGS.has(tag))
        ? 4
        : null;

  return {
    ...role,
    // eligibility floors — null means "unknown, no hard gate"
    daparFloor: VALID_DAPAR.has(role.daparFloor) ? role.daparFloor : null,
    medicalFloor: VALID_MEDICAL.has(role.medicalFloor) ? role.medicalFloor : null,
    // service + location (empty until enriched; report Phase-4 kill-switch reads these)
    serviceLengthMonths: Number.isFinite(role.serviceLengthMonths) ? role.serviceLengthMonths : null,
    serviceLengthLabel: typeof role.serviceLengthLabel === "string" ? role.serviceLengthLabel : "",
    locations: Array.isArray(role.locations) ? role.locations : [],
    dayToDay: typeof role.dayToDay === "string" ? role.dayToDay : "",
    requirements: Array.isArray(role.requirements) ? role.requirements : [],
    // intensities — derived from tags/flags when not enriched
    physicalDemand,
    techIntensity,
    peopleIntensity,
    competitiveness: pickEnum(role.competitiveness, VALID_COMPETITIVENESS, role.selective ? "high" : "medium"),
    genderEligibility: pickEnum(role.genderEligibility, VALID_GENDER_ELIG, deriveGenderEligibility(role)),
    keyDimensions: normalizedKeyDimensions,
    popularity: pickEnum(role.popularity, VALID_POPULARITY, "known"),
    tier: pickEnum(role.tier, VALID_TIER, "standard"),
    maleMedicalMax: Number.isFinite(Number(role.maleMedicalMax)) ? Number(role.maleMedicalMax) : null,
    // Structured assessment affinities. Unknown operational data stays unknown
    // so it scores neutrally; none of these derived fields are eligibility gates.
    interestAreas,
    avoidanceSignals: deriveAvoidanceSignals(role, tags, physicalDemand, environment),
    environment,
    exitPatterns: normalizedEnumArray(
      role.exitPatterns || role.exitsPatterns || role.exits,
      VALID_EXIT_PATTERNS,
    ),
    leadershipDemand,
    teamworkDemand,
    stressDemand,
    motivationSignals: deriveMotivationSignals(role, tags, normalizedKeyDimensions),
    technicalAreas,
    technicalLevelDemand: hasTechnicalSignal
      ? clampInt(role.technicalLevelDemand, 1, 5, techIntensity)
      : null,
    combatFitnessDemand: role.combat
      ? clampInt(role.combatFitnessDemand, 1, 5, physicalDemand)
      : null,
    combatReadinessDemand: role.combat
      ? clampInt(role.combatReadinessDemand, 1, 5, 4)
      : null,
    enrichment: {
      status: pickEnum(enrichment.status, VALID_ENRICH_STATUS, "none"),
      confidence: enrichment.confidence || "low",
      enrichedAt: enrichment.enrichedAt || null,
    },
  };
}

let cachedV3;

/** Parsed catalog with every role normalized to complete v3 shape. Cached. */
export function getIdfRoleCatalogV3() {
  if (cachedV3 !== undefined) return cachedV3;
  const parsed = getIdfRoleCatalogParsed();
  if (!parsed?.roles?.length) {
    cachedV3 = parsed ? { ...parsed, roles: [] } : null;
    return cachedV3;
  }
  const overrides = loadEnrichmentOverrides();
  let enrichedCount = 0;
  const roles = parsed.roles.map((r) => {
    const ov = overrides[r.roleTitle];
    if (ov) enrichedCount++;
    return normalizeRoleV3(ov ? { ...r, ...ov } : r);
  });
  cachedV3 = {
    ...parsed,
    // Reflects that output is v3 (also namespaces the match cache via profileHash).
    schemaVersion: "idf-role-preference-recommender-v3",
    enrichedCount,
    roles,
  };
  return cachedV3;
}

/** Test/enrichment helper — clears the memoized v3 catalog. */
export function _resetV3Cache() {
  cachedV3 = undefined;
}
