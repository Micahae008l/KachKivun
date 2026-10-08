import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "./recommendationAccess.js";

const text = (value) => (typeof value === "string" ? value : "");
const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const strings = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const SCORE_BREAKDOWN_KEYS = [
  "preference",
  "focus",
  "yom",
  "eligibility",
  "catalogQuality",
  "structuredAssessment",
];

function scoreBreakdown(value) {
  if (!value || typeof value !== "object") return null;
  const output = {};
  for (const key of SCORE_BREAKDOWN_KEYS) {
    const numeric = Number(value[key]);
    if (!Number.isFinite(numeric)) return null;
    output[key] = Math.max(0, Math.min(100, Math.round(numeric)));
  }
  return output;
}

function normalizedAccess(access) {
  const paywallEnabled = Boolean(access?.paywallEnabled);
  return {
    paywallEnabled,
    topTwoUnlocked: !paywallEnabled || access?.topTwoUnlocked === true,
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  };
}

function rankedRoles(doc) {
  const roles = Array.isArray(doc?.roles) ? doc.roles : [];
  return roles
    .map((role, index) => ({
      role: role?.toObject ? role.toObject() : role || {},
      rank:
        Number.isInteger(Number(role?.rank)) &&
        Number(role.rank) >= 1 &&
        Number(role.rank) <= 5
          ? Number(role.rank)
          : index + 1,
      index,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, 5);
}

function serializeFullRole(role, rank) {
  return {
    kind: "role",
    locked: false,
    rank,
    roleTitle: text(role.roleTitle),
    matchPercentage: numberOrNull(role.matchPercentage) ?? 0,
    scoreBreakdown: scoreBreakdown(role.scoreBreakdown),
    summary: text(role.summary),
    description: text(role.description),
    tags: strings(role.tags),
    nextStepPrompts: strings(role.nextStepPrompts),
    category: text(role.category),
    combat: Boolean(role.combat),
    dayToDay: text(role.dayToDay),
    requirements: strings(role.requirements),
    locations: strings(role.locations),
    serviceLengthLabel: text(role.serviceLengthLabel),
    admissionChance: ["high", "medium", "low", "unknown"].includes(role.admissionChance?.level)
      ? {
          level: role.admissionChance.level,
          label: text(role.admissionChance.label),
          reason: text(role.admissionChance.reason),
        }
      : null,
  };
}

function serializeLockedRole(role, rank) {
  return {
    kind: "locked",
    locked: true,
    rank,
    matchPercentage: numberOrNull(role.matchPercentage) ?? 0,
  };
}

export function serializeRecommendationRoles(doc, access) {
  const resolvedAccess = normalizedAccess(access);
  return rankedRoles(doc).map(({ role, rank }) =>
    !resolvedAccess.topTwoUnlocked && rank <= 2
      ? serializeLockedRole(role, rank)
      : serializeFullRole(role, rank),
  );
}

export function serializeRecommendation(doc, access) {
  const resolvedAccess = normalizedAccess(access);
  const recommendationId = doc?._id ? String(doc._id) : "";
  return {
    recommendationId,
    createdAt: doc?.createdAt ?? null,
    updatedAt: doc?.updatedAt ?? null,
    engineVersion: text(doc?.engineVersion),
    scoringVersion: text(doc?.scoringVersion),
    catalogVersion: text(doc?.catalogVersion),
    promptVersion: text(doc?.promptVersion),
    notice: text(doc?.notice),
    personalAnswer: text(doc?.personalAnswer),
    roles: serializeRecommendationRoles(doc, resolvedAccess),
    access: resolvedAccess,
  };
}

export function serializeRecommendationSummary(doc, access) {
  const serialized = serializeRecommendation(doc, access);
  const top = serialized.roles.find((role) => role.rank === 1);
  const visibleRoles = serialized.roles.filter((role) => role.kind === "role");
  return {
    id: serialized.recommendationId,
    recommendationId: serialized.recommendationId,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
    engineVersion: serialized.engineVersion,
    topRole: top?.kind === "role" ? top.roleTitle : "",
    topMatch: top?.matchPercentage ?? null,
    roleCount: serialized.roles.length,
    roleTitles: visibleRoles.map((role) => role.roleTitle).filter(Boolean),
    access: serialized.access,
  };
}

export function serializeRecommendationDetail(doc, access) {
  const serialized = serializeRecommendation(doc, access);
  return {
    ...serializeRecommendationSummary(doc, access),
    scoringVersion: serialized.scoringVersion,
    catalogVersion: serialized.catalogVersion,
    promptVersion: serialized.promptVersion,
    notice: serialized.notice,
    personalAnswer: serialized.personalAnswer,
    roles: serialized.roles,
  };
}
