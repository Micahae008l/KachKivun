import { sanitizeScoreBreakdown } from "./roleScoring.js";

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value, { maxItems, maxLength }) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => cleanText(item, maxLength))
        .filter(Boolean),
    ),
  ].slice(0, maxItems);
}

function canonicalTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function fallbackTags(role) {
  return cleanStringArray(
    [
      role.combat ? "לחימה" : "",
      role.category,
      ...(Array.isArray(role.tagsHe) ? role.tagsHe : []),
      ...(Array.isArray(role.signals) ? role.signals : []),
      ...(Array.isArray(role.preferenceTags) ? role.preferenceTags : []),
    ],
    { maxItems: 6, maxLength: 80 },
  );
}

function fallbackSummary(role) {
  return `הנתונים וההעדפות שלכם מציבים את ${role.roleTitle} בין חמש ההתאמות המובילות.`;
}

function fallbackDescription(role, profile) {
  const profileFacts = [
    Number.isFinite(profile?.daparScore) ? `דפ״ר ${profile.daparScore}` : "",
    Number.isFinite(profile?.medicalProfile)
      ? `פרופיל רפואי ${profile.medicalProfile}`
      : "",
  ]
    .filter(Boolean)
    .join(" ו");
  const basis = profileFacts
    ? `הדירוג הדטרמיניסטי שקל ${profileFacts}, ציוני מא״ה והעדפות מהשאלון.`
    : "הדירוג הדטרמיניסטי שקל את נתוני הפרופיל והעדפות השאלון.";
  const daily = cleanText(role.dayToDay, 1200);
  const unknownCaveat =
    !Number.isFinite(profile?.daparScore) || !Number.isFinite(profile?.medicalProfile)
      ? " נתוני סף חסרים לא נחשבו כאפס, ולכן לא ניתן לאמת זכאות."
      : "";
  return `${basis}${daily ? ` בשגרה: ${daily}` : ""}${unknownCaveat} יש לאמת תנאי מיון וזכאות עדכניים בערוצים הרשמיים.`;
}

function fallbackNextSteps(role) {
  return [
    `מהם תנאי המיון העדכניים ל${role.roleTitle}?`,
    `איך נראה יום טיפוסי ב${role.roleTitle}?`,
  ];
}

function findAiCopy(rawRoles, role) {
  const exactTitle = String(role.roleTitle || "").trim();
  const exact = rawRoles.find(
    (candidate) => String(candidate?.roleTitle || "").trim() === exactTitle,
  );
  if (exact) return exact;

  const wanted = canonicalTitle(exactTitle);
  if (!wanted) return null;
  const normalizedMatches = rawRoles.filter(
    (candidate) => canonicalTitle(candidate?.roleTitle) === wanted,
  );
  return normalizedMatches.length === 1 ? normalizedMatches[0] : null;
}

/**
 * Locks v3 order and scores to the deterministic ranking. AI output is treated
 * only as optional copy keyed by canonical catalog title.
 */
export function finalizeRolesV3(rawRoles, rankedRoles, profile = {}) {
  const copyCandidates = Array.isArray(rawRoles)
    ? rawRoles.filter((role) => role && typeof role === "object")
    : [];

  return (rankedRoles || []).slice(0, 5).map((role, index) => {
    const aiCopy = findAiCopy(copyCandidates, role);
    const description =
      cleanText(aiCopy?.description, 4000) || fallbackDescription(role, profile);
    const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim() || "";
    const summary =
      cleanText(aiCopy?.summary, 600) ||
      (firstSentence.length <= 220 ? firstSentence : "") ||
      fallbackSummary(role);
    const tags = fallbackTags(role);
    const aiNextSteps =
      aiCopy?.nextStepPrompts ?? aiCopy?.nextSteps ?? aiCopy?.prompts;
    const nextStepPrompts =
      cleanStringArray(aiNextSteps, { maxItems: 4, maxLength: 500 }).length > 0
        ? cleanStringArray(aiNextSteps, { maxItems: 4, maxLength: 500 })
        : fallbackNextSteps(role);

    return {
      rank: index + 1,
      roleTitle: String(role.roleTitle || "").trim(),
      matchPercentage: Math.max(
        0,
        Math.min(100, Math.round(Number(role.basePercent) || 0)),
      ),
      scoreBreakdown: sanitizeScoreBreakdown(role.scoreBreakdown),
      summary,
      description,
      tags,
      nextStepPrompts,
      category: cleanText(role.category, 240),
      combat: Boolean(role.combat),
      dayToDay: cleanText(role.dayToDay, 4000),
      requirements: cleanStringArray(role.requirements, {
        maxItems: 20,
        maxLength: 500,
      }),
      locations: cleanStringArray(role.locations, {
        maxItems: 20,
        maxLength: 300,
      }),
      serviceLengthLabel: cleanText(role.serviceLengthLabel, 500),
    };
  });
}
