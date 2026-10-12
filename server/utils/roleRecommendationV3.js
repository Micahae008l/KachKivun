import { sanitizeScoreBreakdown } from "./roleScoring.js";

// The owner's style: no em dashes in anything a user reads, including AI-written role text.
function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s*—\s*/g, ", ")
    .trim()
    .slice(0, maxLength);
}

function cleanStringArray(value, { maxItems, maxLength }) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );
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
    ],
    { maxItems: 6, maxLength: 80 },
  );
}

const YOM_LABELS = {
  technicalActivation: "הפעלה טכנית והבנת מערכות",
  spatialPerception: "תפיסה מרחבית",
  dataProcessing: "עיבוד מידע",
  teamwork: "עבודת צוות",
  command: "פיקוד",
  instruction: "הדרכה",
  interpersonalCare: "טיפול באדם",
  diligencePersistence: "השקעה והתמדה",
  managementOrganization: "ניהול וארגון",
  frameworkBehavior: "התנהגות מסגרתית",
  maturity: "בגרות ובשלות",
};
const FOCUS_LABELS = {
  Tech: "טכנולוגיה",
  Physical: "פעילות פיזית ושטח",
  Research: "מחקר ומודיעין",
  Medical: "רפואה וטיפול באנשים",
};
const WANTS_COMBAT = new Set(["Kravi", "FieldCombat", "Mixed"]);
const NO_COMBAT = new Set(["Jobnik", "SupportHQ", "TechTrack", "MedicalInstruction"]);
const trustedFloors = (role) =>
  role.enrichment?.status === "reviewed" || role.enrichment?.status === "verified";

/**
 * The reasons this role ranked for this person, strongest first, taken from the same inputs
 * the score used. Used when the AI returned no copy, so the card still reads as personal.
 */
export function personalReasons(role, profile = {}) {
  const reasons = [];
  const sub = role._subscores || {};

  if (profile.yomSource !== "unknown" && profile.yom) {
    const strong = (role.keyDimensions || [])
      .filter((dim) => YOM_LABELS[dim] && Number(profile.yom[dim]) >= 4)
      .sort((x, y) => profile.yom[y] - profile.yom[x])
      .slice(0, 2);
    if (strong.length) {
      const parts = strong.map((dim) => `${profile.yom[dim]} מתוך 5 ב${YOM_LABELS[dim]}`);
      const lead = profile.yomSource === "self" ? "דירגתם את עצמכם" : "ביום המא״ה קיבלתם";
      reasons.push(
        `${lead} ${parts.join(" ו־")}, ו${strong.length > 1 ? "אלה המדדים המרכזיים" : "זה המדד המרכזי"} ב${role.roleTitle}.`,
      );
    }
  }

  if (FOCUS_LABELS[profile.focus] && Number(sub.focusFit) >= 0.6) {
    reasons.push(
      `ביקשתם שירות עם דגש על ${FOCUS_LABELS[profile.focus]}, והתפקיד הזה יושב בדיוק שם.`,
    );
  }

  const dapar = Number.isFinite(profile.daparScore) ? profile.daparScore : null;
  const floor = Number.isFinite(role.daparFloor) ? role.daparFloor : null;
  if (dapar != null && floor != null && trustedFloors(role) && dapar >= floor) {
    const margin = dapar - floor;
    reasons.push(
      margin >= 20
        ? `הדפ״ר שלכם (${dapar}) גבוה ב־${margin} נקודות מהסף של התפקיד (${floor}), כך שאתם נכנסים למיון בעמדה טובה.`
        : margin >= 10
          ? `הדפ״ר שלכם (${dapar}) עובר את הסף של התפקיד (${floor}) עם מרווח.`
          : `הדפ״ר שלכם (${dapar}) עומד בדיוק בסף של התפקיד (${floor}), אז המיון עצמו יכריע.`,
    );
  }

  if (role.combat && WANTS_COMBAT.has(profile.combatPreference)) {
    reasons.push("סימנתם שאתם רוצים שירות קרבי, וזה תפקיד לחימה.");
  } else if (!role.combat && NO_COMBAT.has(profile.combatPreference)) {
    reasons.push("העדפתם שירות שאינו קרבי, וזה בדיוק האופי של התפקיד.");
  }

  if (profile.physicalActivityLevel === "High" && Number(role.physicalDemand) >= 4) {
    reasons.push("דיווחתם על רמת כושר גבוהה, והתפקיד דורש אותה ביומיום.");
  } else if (profile.physicalActivityLevel === "Low" && Number(role.physicalDemand) <= 2) {
    reasons.push("העומס הפיזי בתפקיד נמוך, בהתאם למה שסימנתם.");
  }

  return reasons;
}

function fallbackSummary(role) {
  return `הנתונים וההעדפות שלכם מציבים את ${role.roleTitle} בין חמש ההתאמות המובילות.`;
}

/** Reasons in a different order per rank, so five cards for one person do not open the same way. */
function reasonsForRank(role, profile, index) {
  const reasons = personalReasons(role, profile);
  const shift = reasons.length ? index % reasons.length : 0;
  return [...reasons.slice(shift), ...reasons.slice(0, shift)];
}

/** What is specific to this role, so two similar roles still read differently. */
function roleSentence(role) {
  const daily = cleanText(role.dayToDay, 1200);
  if (daily) return `ביומיום: ${daily}`;
  const signals = cleanStringArray(role.signals, { maxItems: 3, maxLength: 80 });
  return signals.length ? `בתפקיד הזה עוסקים בעיקר ב: ${signals.join(", ")}.` : "";
}

function profileBasis(profile) {
  const facts = [
    Number.isFinite(profile?.daparScore) ? `דפ״ר ${profile.daparScore}` : "",
    Number.isFinite(profile?.medicalProfile) ? `פרופיל רפואי ${profile.medicalProfile}` : "",
  ]
    .filter(Boolean)
    .join(" ו");
  return facts
    ? `ההתאמה חושבה לפי ${facts}, ציוני המא״ה וההעדפות שסימנתם.`
    : "ההתאמה חושבה לפי ההעדפות שסימנתם בשאלון.";
}

function fallbackDescription(role, profile, index = 0) {
  const [, ...more] = reasonsForRank(role, profile, index);
  const unknownCaveat =
    !Number.isFinite(profile?.daparScore) || !Number.isFinite(profile?.medicalProfile)
      ? " חסרים לנו דפ״ר או פרופיל, ולכן אי אפשר לאמת שאתם עומדים בסף."
      : "";
  const body = [more.slice(0, 2).join(" ") || profileBasis(profile), roleSentence(role)]
    .filter(Boolean)
    .join(" ");
  return `${body}${unknownCaveat} את תנאי המיון העדכניים כדאי לאמת באתר מתגייסים.`;
}

function fallbackNextSteps(role) {
  return [`מהם תנאי המיון העדכניים ל${role.roleTitle}?`, `איך נראה יום טיפוסי ב${role.roleTitle}?`];
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
      cleanText(aiCopy?.description, 4000) || fallbackDescription(role, profile, index);
    const aiDescription = cleanText(aiCopy?.description, 4000);
    const firstSentence = aiDescription.split(/(?<=[.!?])\s+/)[0]?.trim() || "";
    // Without AI copy the headline is the strongest personal reason, never a repeat of the body.
    const summary =
      cleanText(aiCopy?.summary, 600) ||
      (firstSentence && firstSentence.length <= 220 ? firstSentence : "") ||
      reasonsForRank(role, profile, index)[0] ||
      fallbackSummary(role);
    const tags = fallbackTags(role);
    const aiNextSteps = aiCopy?.nextStepPrompts ?? aiCopy?.nextSteps ?? aiCopy?.prompts;
    const nextStepPrompts =
      cleanStringArray(aiNextSteps, { maxItems: 4, maxLength: 500 }).length > 0
        ? cleanStringArray(aiNextSteps, { maxItems: 4, maxLength: 500 })
        : fallbackNextSteps(role);

    return {
      rank: index + 1,
      roleTitle: String(role.roleTitle || "").trim(),
      matchPercentage: Math.max(0, Math.min(100, Math.round(Number(role.basePercent) || 0))),
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
