import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chatJson } from "../utils/llmClient.js";
import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import { recordAiUsage } from "../utils/recordAiUsage.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import {
  YOM_HAMEAH_KEYS,
  YOM_HAMEAH_LABELS_HE,
  migrateLegacyYomHameah,
} from "../utils/yomHameahKeys.js";
import { getIdfRoleCatalogParsed } from "../utils/idfRoleCatalog.js";
import { preFilterRoles } from "../utils/rolePreFilter.js";
import { getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import {
  SCORING_VERSION,
  buildCandidatePool,
  blendPercent,
  seedFromString,
  computeProfileHash,
  buildProfileNotice,
  normalizeAssessmentSignals,
  rankRolesV3,
  sanitizeScoreBreakdown,
} from "../utils/roleScoring.js";
import { finalizeRolesV3 } from "../utils/roleRecommendationV3.js";
import AiMatchResult from "../models/AiMatchResult.js";
import MatchGeneration from "../models/MatchGeneration.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";
import { serializeRecommendation } from "../utils/recommendationSerializer.js";
import { sendServerError } from "../utils/httpError.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSystemPrompt() {
  try {
    return fs.readFileSync(path.join(__dirname, "../prompts/match-roles-system.txt"), "utf8");
  } catch {
    return `You are an expert IDF placement counselor. Respond with ONLY a valid JSON object: {"roles":[...]} with 5 role objects (roleTitle, matchPercentage, summary, description, tags). summary = one Hebrew sentence; description = 2-3 Hebrew sentences.`;
  }
}

const BASE_SYSTEM_PROMPT = loadSystemPrompt();

function loadSystemPromptV2() {
  try {
    return fs.readFileSync(path.join(__dirname, "../prompts/match-roles-system-v2.txt"), "utf8");
  } catch {
    return BASE_SYSTEM_PROMPT;
  }
}
const BASE_SYSTEM_PROMPT_V2 = loadSystemPromptV2();

/** v2 system prompt: pre-scored pool with rich v3 fields; model returns adjustment, not matchPercentage. */
export function buildSystemPromptV2(pool) {
  const catalogSection = pool?.length
    ? `

---

## מאגר תפקידים מדורג מראש (JSON — בחרו מתוכו בלבד)

להלן ${pool.length} תפקידים שדורגו מראש ע"י מנוע הניקוד עבור המועמד. בחרו את 5 הטובים ביותר, החזירו adjustment (מ-8- עד 8+) לכל אחד, ואל תמציאו תפקידים שאינם ברשימה.

${JSON.stringify(
  pool.map((r) => ({
    roleTitle: r.roleTitle,
    category: r.category,
    combat: r.combat,
    basePercent: r.basePercent,
    breakdownHe: r.breakdownHe,
    tier: r.tier,
    requestMatch: r.requestMatch || undefined,
    admissionChance: r.admissionChance
      ? `${r.admissionChance.label}${r.admissionChance.reason ? `: ${r.admissionChance.reason}` : ""}`
      : undefined,
    dayToDay: r.dayToDay ? String(r.dayToDay).slice(0, 220) : undefined,
    requirements: r.requirements?.length ? r.requirements : undefined,
    serviceLengthLabel: r.serviceLengthLabel || undefined,
    keyDimensions: r.keyDimensions,
  })),
  null,
  0
)}`
    : "";
  return `${BASE_SYSTEM_PROMPT_V2}\n\n${VERIFIED_FACTS_HE}${catalogSection}`;
}

export // Verified against mitgaisim.idf.il and the July 2026 service-length law. See docs/IDF-FACTS-AND-SITE-GAPS.md.
const VERIFIED_FACTS_HE = `עובדות מאומתות (אוקטובר 2026), השתמש רק בהן ואל תוסיף מספרים משלך:
- שירות חובה: גברים 32 חודשים (למתגייסים עד יוני 2029). נשים 24 חודשים, או 32 בתפקידי "דין אישה כדין גבר" (כל תפקידי הלחימה ורוב מסלולי הטכנולוגיה והמודיעין).
- פרופיל: 97 הכול כולל יחידות מובחרות; 82 חי"ר, סיירות והנדסה קרבית; 72 שאר הלחימה (שריון, תותחנים, הגנה אווירית, חילוץ, חי"ר גבולות); 64 תומכי לחימה ומעברים; 45 עורפי.
- דפ"ר: סף נפוץ לטכנולוגיה ומודיעין 60; תוכניתן, מגן סייבר, DevOps ולה"ב 70; שחקים 80-90; תלפיות 90. בנים עם פרופיל קרבי צריכים דפ"ר 80 ו-10 יח"ל טכנולוגיות למיוני אשכול מקצועות המחשב.
- בן עם פרופיל 72, 82 או 97 הוא "מיועד ללוחמה": הוא מקבל את שאלון ההעדפות של יחידות השדה ותפקידי עורף לא מופיעים בו. פרופיל גבוה אינו "פותח הכול"; לטכנולוגיה הוא מגיע רק דרך מיון שמקבל פרופיל קרבי: אשכול מקצועות המחשב ("מיוני ממר"ם", דורש לבעלי פרופיל קרבי דפ"ר 80 ו-10 יח"ל טכנולוגיות), שחקים, גאמ"א, חבצלות, עתודה, חיל האוויר. יום המיון לכלל חמ"ן אינו מזמין בנים המיועדים ללוחמה. מאז יוני 2024 צומצמו מכסות בעלי פרופיל קרבי ב-8200 ובתקשוב. נשים בוחרות לוחמה מרצון ואין להן מגבלה כזו.
- "ממר"ם" בפי המועמדים = מיוני אשכול מקצועות המחשב של אגף התקשוב (תוכניתן, מגן סייבר, DevOps, בודק תוכנה, דאטא אנליסט); מתקיימים כפעמיים בשנה.
- 8200 אינה מופיעה בשמה באתר מתגייסים; המסלולים הם אמנון, אח"מ, אע"מ, מט"מ, אופק, גאמ"א, שחקים. מגן סייבר שייך לאגף התקשוב, לא ל-8200.
- מבחן דפ"ר חוזר מאושר רק למי שהדפ"ר שלו 70 ומטה; למי שיש 80 או 90 אין "להעלות דפ"ר". קב"א כמעט לא מוצג היום למועמדים. צה"ל לא מפרסם מערכת יציאות לפי תפקיד; מה שרשמי הוא בסיס סגור או פתוח.
- התחייבות קבע: תוכניתן 2.5 שנים, מגן סייבר 2, DevOps 1, גאמ"א ואמנון 3, שלדג 18 חודשים, סיירת מטכ"ל 3 שנים, חובלים 5, טיס 7, עתודה 3.`;

export function buildSystemPromptV3(rankedRoles) {
  return `אתה עורך תוכן ליועץ תפקידים בצה"ל. מנוע דטרמיניסטי כבר קבע את חמשת התפקידים, הסדר והציונים.

כללי חוזה:
- החזר JSON בלבד עם מפתח roles ובו בדיוק חמש רשומות.
- החזר כל roleTitle בדיוק כפי שנמסר, ללא החלפה, השמטה או שינוי סדר.
- אל תחזיר matchPercentage או adjustment. אינך רשאי לשנות ציון או דירוג.
- לכל תפקיד כתוב רק summary בעברית ו-description בעברית.
- הוסף nextStepPrompts עם 1 עד 3 שאלות קצרות בעברית שהמועמד/ת יכולים לשאול את מיטב (1111) או נציג היחידה על התפקיד (למשל "מתי חלון המיונים הבא?"), לא שאלות ראיון למועמד.
- אל תחזיר tags, category, requirements, dayToDay, locations, serviceLength, rank או נתוני זכאות; כל המטא-דאטה מגיע מהמנוע הדטרמיניסטי בלבד.
- אם מופיעה "בקשה אישית של המועמד/ת", החזר גם מפתח personalAnswer ברמת השורש: 3-5 משפטים בעברית שעונים עליה ישירות, בגוף שני, רק לפי העובדות המאומתות ונתוני התפקידים; אם אין בקשה, החזר personalAnswer ריק.
- אין להמציא תנאי סף. הצג את הזכאות ככפופה לאימות בערוצים הרשמיים.

${VERIFIED_FACTS_HE}

התפקידים הנעולים בסדר הקנוני:
${JSON.stringify(
  (rankedRoles || []).map((role, index) => ({
    rank: index + 1,
    roleTitle: role.roleTitle,
    category: role.category,
    combat: role.combat,
    dayToDay: role.dayToDay || undefined,
    requirements: role.requirements?.length ? role.requirements : undefined,
    keyDimensions: role.keyDimensions,
    breakdownHe: role.breakdownHe,
  })),
)}

מבנה התשובה:
{"roles":[{"roleTitle":"שם מדויק","summary":"משפט קצר","description":"2-3 משפטים","nextStepPrompts":["שאלת המשך"]}],"personalAnswer":"תשובה לבקשה האישית או מחרוזת ריקה"}`;
}

/**
 * Build the system prompt with an inline filtered catalog subset.
 * Much smaller than the full 302-role dump → model can reason properly.
 */
function buildSystemPrompt(filteredRoles) {
  const catalogSection = filteredRoles?.length
    ? `

---

## מאגר תפקידים מסונן (JSON — חובת עבודה)

להלן ${filteredRoles.length} תפקידי צה"ל שסוננו מראש כמתאימים פוטנציאלית לפרופיל המועמד. זהו מקור העדפתכם — בחרו מתוכו.

חובות:
- בחרו roleTitle שמופיע במדויק (או כמעט) מתוך הרשומות למטה.
- אל תמציאו תפקידים שלא ברשימה; אם חסר — השתמשו ברשומה הכי קרובה.
- שימו לב לשדות signals ו-aiRecommendationHint — הם מנחים את ההתאמה.

${JSON.stringify(filteredRoles.map(r => ({
  roleTitle: r.roleTitle,
  category: r.category,
  combat: r.combat,
  selective: r.selective,
  preferenceTags: r.preferenceTags,
  signals: r.signals,
  bestFor: r.bestFor,
  aiRecommendationHint: r.aiRecommendationHint,
})), null, 0)}`
    : "";

  return BASE_SYSTEM_PROMPT + catalogSection;
}

/**
 * Normalize model output: JSON mode object, legacy raw array, or fenced / prefixed text.
 */
/** Root-level personalAnswer string, if the model returned one. */
export function parsePersonalAnswer(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim().replace(/^```(?:json)?\s*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return "";
  try {
    const parsed = JSON.parse(s.slice(start, end + 1));
    return typeof parsed?.personalAnswer === "string" ? parsed.personalAnswer.trim().slice(0, 2000) : "";
  } catch {
    return "";
  }
}

export function parseRolesArray(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();

  const tryParse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(s);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.roles)) return parsed.roles;

  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start !== -1 && end > start) {
    parsed = tryParse(s.slice(start, end + 1));
    if (Array.isArray(parsed)) return parsed;
  }

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    parsed = tryParse(s.slice(objStart, objEnd + 1));
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.roles)) return parsed.roles;
  }

  return null;
}

const AI_MODEL = process.env.AI_MATCH_MODEL || "gpt-4o";
const AI_TEMPERATURE = parseFloat(process.env.AI_MATCH_TEMPERATURE) || 0.2;

const configuredMatchEngine = (process.env.AI_MATCH_ENGINE || "v3").toLowerCase();
const MATCH_ENGINE = ["v1", "v2", "v3"].includes(configuredMatchEngine)
  ? configuredMatchEngine
  : "v3";
const MATCH_PROMPT_VERSION =
  MATCH_ENGINE === "v3"
    ? "match-v3-2026-09-integrity-copy-2"
    : "match-v2-2026-10-request-signals";

/**
 * v2: convert the model's {roleTitle, adjustment, ...} into final RoleMatch objects.
 * Percentage = deterministic basePercent (looked up from the pool) + clamped AI adjustment.
 * Enforces strict descending order so the UI's ranked layout is always monotonic.
 */
/** Models normalize Hebrew gershayim/geresh (״ ׳) to ASCII quotes; compare titles without quote style. */
export function normalizeRoleTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .replace(/[״"”“]/g, '"')
    .replace(/[׳'’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function finalizeRolesV2(rawRoles, pool) {
  const byTitle = new Map(pool.map((r) => [normalizeRoleTitle(r.roleTitle), r]));
  const titles = [...byTitle.keys()];

  const out = rawRoles.map((r) => {
    const roleTitle = normalizeRoleTitle(r.roleTitle);
    let poolRole = byTitle.get(roleTitle);
    if (!poolRole) {
      const hit = titles.find((t) => t.includes(roleTitle) || roleTitle.includes(t));
      if (hit) poolRole = byTitle.get(hit);
      if (!poolRole) console.warn(`[ai/match-roles v2] unknown roleTitle from model: "${roleTitle}"`);
    }
    const basePercent = poolRole?.basePercent ?? 60;
    const description = String(r.description || "").trim();
    let summary = String(r.summary || "").trim();
    if (!summary && description) {
      const first = description.split(/(?<=[.!?])\s+/)[0]?.trim();
      summary = first && first.length <= 140 ? first : `${description.slice(0, 120).trim()}…`;
    }
    const title = poolRole?.roleTitle || roleTitle;
    const aiPrompts = Array.isArray(r.nextStepPrompts)
      ? r.nextStepPrompts.map((p) => String(p).trim()).filter(Boolean).slice(0, 3)
      : [];
    // Official per-role facts come from the catalog, never from the model.
    const baseFact =
      poolRole?.closedBase === true ? "בסיס סגור" : poolRole?.closedBase === false ? "בסיס פתוח" : "";
    return {
      roleTitle: title,
      matchPercentage: blendPercent(basePercent, r.adjustment),
      scoreBreakdown: poolRole?.scoreBreakdown
        ? sanitizeScoreBreakdown(poolRole.scoreBreakdown)
        : null,
      summary,
      description,
      tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [],
      nextStepPrompts: aiPrompts.length
        ? aiPrompts
        : [`מתי חלון המיונים הבא ל${title}?`, `מה תנאי הקבלה העדכניים ל${title}?`],
      category: poolRole?.category || "",
      combat: Boolean(poolRole?.combat),
      dayToDay: poolRole?.dayToDay || "",
      requirements: [...(baseFact ? [baseFact] : []), ...(poolRole?.requirements || [])].slice(0, 20),
      locations: poolRole?.locations || [],
      serviceLengthLabel: poolRole?.serviceLengthLabel || "",
      admissionChance: poolRole?.admissionChance || null,
    };
  });

  out.sort((a, b) => b.matchPercentage - a.matchPercentage);
  for (let i = 1; i < out.length; i++) {
    if (out[i].matchPercentage >= out[i - 1].matchPercentage) {
      out[i].matchPercentage = Math.max(30, out[i - 1].matchPercentage - 1);
    }
  }
  return out;
}

function snapshotThreshold(value) {
  if (value === "unknown") return "unknown";
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function profileSnapshot(profile) {
  return {
    daparScore: snapshotThreshold(profile.daparScore),
    medicalProfile: snapshotThreshold(profile.medicalProfile),
    gender: profile.gender || "",
    combatPreference: profile.combatPreference || "",
    focus: profile.focus || "",
    physicalActivityLevel: profile.physicalActivityLevel || "",
    yomSource: profile.yomSource || "",
    yom: profile.yom ? { ...profile.yom } : null,
    assessmentSignals: normalizeAssessmentSignals(profile),
  };
}

function completeStoredRoles(roles) {
  if (!Array.isArray(roles) || roles.length < 5) return null;
  const normalized = roles.slice(0, 5).map((role, index) => ({
    rank: index + 1,
    roleTitle: String(role?.roleTitle || "").trim(),
    matchPercentage: Math.max(
      0,
      Math.min(100, Math.round(Number(role?.matchPercentage) || 0)),
    ),
    scoreBreakdown:
      role?.scoreBreakdown && typeof role.scoreBreakdown === "object"
        ? sanitizeScoreBreakdown(role.scoreBreakdown)
        : null,
    summary: String(role?.summary || "").trim(),
    description: String(role?.description || "").trim(),
    tags: Array.isArray(role?.tags) ? role.tags : [],
    nextStepPrompts: Array.isArray(role?.nextStepPrompts)
      ? role.nextStepPrompts
      : [],
    category: String(role?.category || "").trim(),
    combat: Boolean(role?.combat),
    dayToDay: String(role?.dayToDay || "").trim(),
    requirements: Array.isArray(role?.requirements) ? role.requirements : [],
    locations: Array.isArray(role?.locations) ? role.locations : [],
    serviceLengthLabel: String(role?.serviceLengthLabel || "").trim(),
    admissionChance: role?.admissionChance?.level ? role.admissionChance : null,
  }));
  return normalized.every((role) => role.roleTitle && role.scoreBreakdown)
    ? normalized
    : null;
}

async function persistRecommendation({
  userId,
  profileHash,
  assessmentId,
  profile,
  roles,
  catalogVersion,
  promptVersion,
  engineVersion,
  notice,
  personalAnswer = "",
  scoringVersion = SCORING_VERSION,
}) {
  const storedRoles = completeStoredRoles(roles);
  if (!storedRoles) {
    throw new Error("A durable recommendation requires five complete ranked roles");
  }

  const update = {
    assessmentId: assessmentId || null,
    profileSnapshot: profileSnapshot(profile),
    engineVersion,
    scoringVersion,
    catalogVersion,
    promptVersion,
    roles: storedRoles,
    notice: String(notice || ""),
    personalAnswer: String(personalAnswer || "").slice(0, 2000),
  };

  try {
    return await RoleRecommendation.findOneAndUpdate(
      { userId, profileHash },
      { $set: update, $setOnInsert: { userId, profileHash } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return RoleRecommendation.findOne({ userId, profileHash }).lean();
  }
}

/** Builds the per-engine user prompt. Exported so scripts can run the exact production prompt offline. */
export function buildMatchUserPrompt({
  engine,
  profileForMatch,
  preferences,
  yom,
  stats,
  assessmentSignals,
  filteredRoleCount,
  personalRequest = "",
}) {
    const requestLine = personalRequest
      ? `- בקשה אישית של המועמד/ת (ענה עליה במפתח personalAnswer): """${personalRequest}"""
`
      : "";
    const legacyQ =
      stats?.yomQuestionnaire?.length > 0
        ? ` (יש גם נתון ישן של שאלון ${stats?.yomQuestionnaire.length} פריטים — אם יש סתירה מול ציוני הממדים, עדיף להסתמך על ציוני הממדים)`
        : "";

    const yomSrc =
      preferences?.yomHameahSource === "official"
        ? "רשמי (מאה/מכון ממיין)"
        : preferences?.yomHameahSource === "self"
          ? "הערכה עצמית לסימולציה בלבד"
          : preferences?.yomHameahSource === "unknown"
            ? "לא ידוע — ציונים ניטרליים הם מצייני מקום בלבד"
            : "לא צוין מקור";

    const daparLabel =
      typeof profileForMatch.daparScore === "number"
        ? String(profileForMatch.daparScore)
        : "לא ידוע";
    const medicalLabel =
      typeof profileForMatch.medicalProfile === "number"
        ? String(profileForMatch.medicalProfile)
        : "לא ידוע";
    const yomKnown = preferences?.yomHameahSource !== "unknown";

    const yomLines = yom && yomKnown
      ? YOM_HAMEAH_KEYS.map(
          (k) => `  • ${k} (${YOM_HAMEAH_LABELS_HE[k] ?? k}): ${typeof yom[k] === "number" ? yom[k] : "—"}/5`
        ).join("\n")
      : preferences?.yomHameahSource === "unknown"
        ? "  (לא ידוע; ציוני 3 ניטרליים נשמרו לתאימות ואסור להסיק מהם חוזקות או זכאות)"
        : "  (לא הוזנו ציוני מאה)";

    // Compute yom peaks and lows for the AI to focus on
    const yomSorted = yom && yomKnown
      ? YOM_HAMEAH_KEYS
          .map(k => ({ key: k, label: YOM_HAMEAH_LABELS_HE[k] ?? k, score: yom[k] }))
          .filter(d => typeof d.score === "number")
          .sort((a, b) => b.score - a.score)
      : [];
    const topDims = yomSorted.filter(d => d.score >= 4).slice(0, 5);
    const lowDims = yomSorted.filter(d => d.score <= 2);

    const strengthsLine = !yomKnown
      ? "ציוני מא״ה אינם ידועים — אין להסיק מהם חוזקות"
      : topDims.length
        ? `חוזקות בולטות: ${topDims.map(d => `${d.label} (${d.score})`).join(", ")}`
        : "אין ציונים בולטים גבוהים";
    const weaknessLine = !yomKnown
      ? "ציוני מא״ה אינם ידועים — אין להסיק מהם חולשות"
      : lowDims.length
        ? `ממדים נמוכים: ${lowDims.map(d => `${d.label} (${d.score})`).join(", ")}`
        : "אין ציונים בולטים נמוכים";

    const userPrompt = engine === "v3"
      ? `ענה לפי כללי המערכת ב-JSON בלבד. כתוב הסברים ושאלות המשך לחמשת התפקידים שכבר דורגו, בלי לבחור תפקידים ובלי לשנות סדר או ציון.

נתוני פרופיל:
- דפ"ר: ${daparLabel}
- פרופיל רפואי: ${medicalLabel}
- מקור ציוני מא"ה: ${yomSrc}
- ציוני מא"ה:
${yomLines}
- ${strengthsLine}
- ${weaknessLine}
- העדפת קרביות: ${preferences?.combatPreference || "לא הוגדר"}
- מיקוד: ${preferences?.focus || "כללי"}
- פעילות גופנית: ${preferences?.physicalActivityLevel || "לא צוין"}
- אותות שאלון מובנים: ${JSON.stringify(assessmentSignals)}
${requestLine}
החזר copy בלבד לכל חמשת השמות המדויקים שסופקו בהוראות המערכת.`
      : engine === "v2" ? `ענה לפי כללי המערכת (JSON בלבד, טקסטים בעברית).

מהמאגר המדורג מראש שבהוראות המערכת, בחר את 5 התפקידים הטובים ביותר עבור המועמד, דרג מ-#1 (החזק ביותר) ל-#5, והחזר adjustment (מ-8- עד 8+) לכל תפקיד. אל תחזיר matchPercentage — המערכת מחשבת אותו מ-basePercent ומה-adjustment שלך.

חוזה ההסבר (חובה בכל description): התייחס בכנות לדפ"ר ${daparLabel} ולפרופיל הרפואי ${medicalLabel}; אם נתון אינו ידוע, אסור להסיק ממנו זכאות. צטט ממד מא"ה רק אם המקור ידוע, ולפחות עובדה אחת מתוך שדה dayToDay של התפקיד.

## פרופיל מועמד

- דפ"ר: ${daparLabel}
- פרופיל רפואי: ${medicalLabel}
- מקור ציוני מאה: ${yomSrc}
- ציוני מאה (כל 11 ממדים):
${yomLines}${legacyQ}
- ${strengthsLine}
- ${weaknessLine}
- העדפת קרביות: ${preferences?.combatPreference || "לא הוגדר"}
- מיקוד: ${preferences?.focus || "כללי"}
- פעילות גופנית: ${preferences?.physicalActivityLevel || "לא צוין"}
- תשובות השאלון המובנה (תחומי עניין, הימנעויות, ניסיון טכנולוגי, מוטיבציות): ${JSON.stringify(assessmentSignals)}
${requestLine}
## סדר עדיפויות בבחירה

1. תנאי סף (דפ"ר, פרופיל) קודמים לכול.
2. הבקשה האישית ותחומי העניין שנבחרו במפורש (rolesInterested) גוברים על ניחוש מתוך הציונים. אם נכתב בבקשה תחום מסוים (למשל רחפנים), התפקידים שעונים עליו צריכים להופיע בחמישייה.
3. תפקידים עם requestMatch: true נוספו למאגר בגלל הבקשה האישית. אם הם עומדים בתנאי הסף, כלול לפחות אחד מהם ודרג אותו גבוה, והסבר בתיאור איך הוא עונה על הבקשה.
4. כשהמועמד/ת מציין/ת שני כיוונים (למשל קרבי וגם טכנולוגיה), העדף תפקידים שמחברים ביניהם על פני תפקידים שעונים רק על אחד.
5. admissionChance הוא הערכת סיכוי הקבלה. תפקיד עם סיכוי נמוך יכול להיכנס לחמישייה אם הוא עונה על הבקשה, אבל אל תמלא את כל החמישייה בתפקידים כאלה, וציין בכנות בתיאור שהסיכוי נמוך ולמה.
6. רק אחר כך העדפות כלליות וציוני מא"ה.

בחר 5 תפקידים מהמאגר בלבד. שמות מדויקים כפי שמופיעים במאגר, תיאורים בעברית בלבד.` : `ענה לפי כללי המערכת (JSON בלבד, טקסטים בעברית).

החזר אובייקט JSON עם מפתח יחיד "roles" (מערך של 5 תפקידים), בדיוק כפי שמוגדר בהוראות המערכת.

## הנחיות חשיבה

לפני שתבחר תפקידים, חשוב שלב-אחר-שלב:

1. מה הדפ״ר (${daparLabel}) מאפשר ומגביל? אם הוא לא ידוע, אל תסיק מגבלה או זכאות.

2. מה הפרופיל הרפואי (${medicalLabel}) מאפשר? אם הוא לא ידוע, אל תסיק מגבלה או זכאות.

3. מה החוזקות הבולטות במא״ה? ${strengthsLine}. התאימו תפקידים שמנצלים חוזקות אלה.

4. מה הממדים הנמוכים? ${weaknessLine}. הימנעו מתפקידים שדורשים בדיוק את הממדים הנמוכים.

5. מה ההעדפות? ${preferences?.combatPreference || "—"} (קרביות), ${preferences?.focus || "—"} (מיקוד), ${preferences?.physicalActivityLevel || "—"} (כושר). כבדו העדפות אבל ציינו בכנות אם משהו סותר.

6. סרקו את ${filteredRoleCount} התפקידים המסוננים ובחרו 5 שמתאימים הכי טוב לשילוב של כל הנ״ל. תפקיד #1 חייב להיות ההתאמה החזקה ביותר, ולאחריו סדר יורד.

## חובה בכל תיאור

בשדה description של כל תפקיד חייבים להופיע במפורש:
(1) לפחות משפט שמתייחס לדפ״ר ${daparLabel}; אם אינו ידוע, מציין שלא ניתן לאמת זכאות.
(2) לפחות משפט שמתייחס לפרופיל רפואי ${medicalLabel}; אם אינו ידוע, מציין שלא ניתן לאמת זכאות.
(3) התייחסות לממד מא״ה רק אם המקור ידוע; אחרת ציין שהמדדים לא ידועים.
(4) הסבר קצר מה עושים ביומיום בתפקיד.

matchPercentage: סדרו מ-#1 (הגבוה ביותר) ל-#5 (הנמוך). #1 יהיה 85-95 רק אם ההתאמה מצוינת. טווחים: 85-95 (מצוין), 72-84 (חזק), 58-71 (סביר).

## פרופיל מועמד

- דפ"ר: ${daparLabel}
- פרופיל רפואי: ${medicalLabel}
- מקור ציוני מאה: ${yomSrc}
- ציוני מאה (כל 11 ממדים):
${yomLines}${legacyQ}
- ${strengthsLine}
- ${weaknessLine}
- העדפת קרביות: ${preferences?.combatPreference || "לא הוגדר"}
- מערכת שבוע: ${preferences?.schedule || "כללי"}
- מיקוד: ${preferences?.focus || "כללי"}
- מיקום: ${preferences?.location || "כל מקום"}
- פעילות גופנית: ${preferences?.physicalActivityLevel || "לא צוין"}

המלץ על 5 תפקידי צה"ל. שמות ותיאורים — בעברית בלבד.`;
    return userPrompt;
}

export async function matchRoles(req, res) {
  const userId = req.userId;
  let userEmail = "";
  let filteredRoleCount = 0;
  let deferredSuccessUsage = null;
  let failureUsageRecorded = false;
  const startedAt = Date.now();

  try {
    const [user, stats, preferences, latestAssessment] = await Promise.all([
      User.findById(userId).select("email role"),
      MilitaryStats.findOne({ userId }),
      Preferences.findOne({ userId }),
      Assessment.findOne({ userId })
        .sort({ completedAt: -1, _id: -1 })
        .lean(),
    ]);
    userEmail = user?.email || "";

    const { ready, missing } = computeAiProfileMissing(
      stats,
      preferences,
      latestAssessment,
    );
    if (!ready) {
      return res.status(400).json({
        error:
          "השלימו את הפרופיל לפני שימוש ביועץ: תאריך גיוס, העדפות שירות (כיוון, מיקוד, כושר), דפ״ר, פרופיל רפואי וציוני מא״ה לכל הממדים.",
        missing,
      });
    }

    // Migrate yom hameah to 12-key format
    const yom = migrateLegacyYomHameah(stats.yomHameah);
    const yomForLegacyScoring =
      preferences?.yomHameahSource === "unknown" ? null : yom;

    const assessmentSignals = normalizeAssessmentSignals(latestAssessment?.answers);
    const profileForMatch = {
      daparScore:
        stats.daparScore ??
        (latestAssessment?.answers?.daparScore === "unknown" ? "unknown" : null),
      medicalProfile:
        stats.medicalProfile ??
        (latestAssessment?.answers?.medicalProfile === "unknown" ? "unknown" : null),
      gender: stats.gender,
      combatPreference: preferences?.combatPreference,
      focus: preferences?.focus,
      physicalActivityLevel: preferences?.physicalActivityLevel,
      yom,
      yomSource: preferences?.yomHameahSource || null,
      assessmentSignals,
      personalRequest: String(latestAssessment?.answers?.extraNote || "").trim().slice(0, 400),
    };
    const profileNotice = buildProfileNotice(profileForMatch);
    const catalogV3 = getIdfRoleCatalogV3();
    const catalogVersion = catalogV3?.schemaVersion || "idf-role-catalog-unknown";

    // Cache: identical profile + catalog + prompt + engine → return the saved
    // result instantly. Logged as cache_hit (not success) so it costs nothing
    // and does not consume the internal generation allowance.
    // Non-default models get their own cache namespace; gpt-4o keeps legacy hashes intact.
    const profileHash = computeProfileHash(
      profileForMatch,
      catalogVersion,
      AI_MODEL === "gpt-4o" ? MATCH_PROMPT_VERSION : `${MATCH_PROMPT_VERSION}|${AI_MODEL}`,
      MATCH_ENGINE,
    );
    const [durableMatch, cachedMatch] = await Promise.all([
      RoleRecommendation.findOne({ userId, profileHash }).lean(),
      AiMatchResult.findOne({
        userId,
        profileHash,
        endpoint: "match-roles",
      }).lean(),
    ]);
    const durableComplete = durableMatch?.roles?.length === 5;
    const legacyComplete = cachedMatch?.roles?.length >= 5;
    if (durableComplete || legacyComplete) {
      await recordAiUsage({
        userId,
        userEmail,
        endpoint: "match-roles",
        model: "cache",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        status: "cache_hit",
        filteredRoleCount: 0,
      });
      let recommendation = durableComplete ? durableMatch : null;
      if (!recommendation && completeStoredRoles(cachedMatch.roles)) {
        recommendation = await persistRecommendation({
          userId,
          profileHash,
          assessmentId: latestAssessment?._id,
          profile: profileForMatch,
          roles: cachedMatch.roles,
          catalogVersion,
          promptVersion: MATCH_PROMPT_VERSION,
          engineVersion: cachedMatch.engineVersion || MATCH_ENGINE,
          scoringVersion: cachedMatch.scoringVersion || SCORING_VERSION,
          notice: profileNotice,
        }).catch((error) => {
          console.error(
            "[ai/match-roles] legacy cache migration failed:",
            error?.message,
          );
          return null;
        });
      }
      const access = await getRecommendationAccessForUser(userId, {
        userRole: user?.role,
      });
      console.log(`[ai/match-roles] cache hit for user ${userId}`);
      const serialized = serializeRecommendation(
        recommendation || { ...cachedMatch, notice: profileNotice },
        access,
      );
      return res.json({ ...serialized, cached: true });
    }

    if (req.callCapStatus?.ok === false || req.tokenCapStatus?.ok === false) {
      return res.status(429).json({
        error: "לא ניתן ליצור התאמה חדשה כרגע. אפשר עדיין לפתוח התאמות שכבר נשמרו.",
        code: "AI_GENERATION_LIMIT_REACHED",
      });
    }

    let filteredRoles;
    let candidatePool = null;
    if (MATCH_ENGINE === "v3") {
      candidatePool = rankRolesV3(catalogV3?.roles || [], profileForMatch, {
        limit: 5,
      });
      if (candidatePool.length !== 5) {
        return res.status(503).json({
          error: "לא נמצאו מספיק תפקידים זכאים ליצירת חמש המלצות.",
        });
      }
      filteredRoles = candidatePool;
      filteredRoleCount = candidatePool.length;
      console.log(
        `[ai/match-roles] engine=v3 deterministic-top=${candidatePool.length} for user ${userId}`,
      );
    } else if (MATCH_ENGINE === "v2") {
      // Wide pool: the AI chooses with the personal request, interests and admission chances in view.
      candidatePool = buildCandidatePool(catalogV3?.roles || [], profileForMatch);
      filteredRoles = candidatePool;
      filteredRoleCount = candidatePool.length;
      console.log(`[ai/match-roles] engine=v2 pool=${candidatePool.length} for user ${userId}`);
    } else {
      const catalog = getIdfRoleCatalogParsed();
      const allRoles = catalog?.roles || [];
      filteredRoles = preFilterRoles(
        allRoles,
        profileForMatch,
        preferences,
        yomForLegacyScoring,
      );
      filteredRoleCount = filteredRoles.length;
      console.log(`[ai/match-roles] engine=v1 pre-filtered ${allRoles.length} → ${filteredRoles.length} for user ${userId}`);
    }

    const userPrompt = buildMatchUserPrompt({
      engine: MATCH_ENGINE,
      profileForMatch,
      preferences,
      yom,
      stats,
      assessmentSignals,
      filteredRoleCount: filteredRoles.length,
      personalRequest: profileForMatch.personalRequest,
    });

    const isV3 = MATCH_ENGINE === "v3";
    const isV2 = MATCH_ENGINE === "v2";
    const systemPrompt = isV3
      ? buildSystemPromptV3(candidatePool)
      : isV2
        ? buildSystemPromptV2(candidatePool)
        : buildSystemPrompt(filteredRoles);

    let roles = [];
    let personalAnswer = "";
    try {
      const completion = await chatJson({
        model: AI_MODEL,
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 8000,
        // 0 so the same profile gets the same picks; the profile-hash cache is the hard guarantee.
        temperature: isV3 || isV2 ? 0 : AI_TEMPERATURE,
        // Deterministic seed from the profile hash → best-effort identical reruns (caching is the hard guarantee).
        seed: isV3 || isV2 ? seedFromString(profileHash) : undefined,
      });
      const durationMs = Date.now() - startedAt;
      const modelUsed = completion.model || AI_MODEL;
      const { promptTokens, completionTokens, content, finishReason } = completion;
      const totalTokens = promptTokens + completionTokens;
      const parsedRoles = parseRolesArray(content);
      personalAnswer = parsePersonalAnswer(content);
      const copyComplete = Array.isArray(parsedRoles) && parsedRoles.length === 5;

      if (finishReason === "length") {
        console.warn("[ai/match-roles] finish_reason=length (possible truncation)");
      }
      if (!copyComplete) {
        console.error(
          "[ai/match-roles] Incomplete AI role copy. Raw (first 400 chars):",
          content.slice(0, 400),
        );
      }

      const usageEntry = {
        userId,
        userEmail,
        endpoint: "match-roles",
        model: modelUsed,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        status: copyComplete ? "success" : "parse_error",
        finishReason,
        openaiRequestId: completion.id ?? null,
        filteredRoleCount,
        errorMessage: copyComplete ? null : "AI omitted or malformed one or more roles",
      };
      if (copyComplete) {
        deferredSuccessUsage = usageEntry;
      } else {
        await recordAiUsage(usageEntry);
        failureUsageRecorded = true;
      }

      if (!Array.isArray(parsedRoles) || parsedRoles.length === 0) {
        if (!isV3) {
          return res.status(502).json({
            error: "AI returned invalid response format. Please try again.",
          });
        }
        roles = [];
      } else {
        roles = parsedRoles;
      }
    } catch (error) {
      if (!isV3) throw error;
      console.error(
        "[ai/match-roles v3] AI copy unavailable; using deterministic fallbacks:",
        error?.message,
      );
      await recordAiUsage({
        userId,
        userEmail,
        endpoint: "match-roles",
        model: AI_MODEL,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        status: "api_error",
        filteredRoleCount,
        errorMessage: error?.message || "AI copy unavailable",
      });
      failureUsageRecorded = true;
      roles = [];
    }

    let normalized;
    if (isV3) {
      normalized = finalizeRolesV3(roles, candidatePool || [], profileForMatch);
    } else if (isV2) {
      // Percentage = deterministic basePercent + clamped AI adjustment; strict descending.
      normalized = finalizeRolesV2(roles, candidatePool || []);
    } else {
      // Ensure roles are sorted by matchPercentage descending
      roles.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
      normalized = roles.map((r) => {
        const description = String(r.description || "").trim();
        let summary = String(r.summary || "").trim();
        if (!summary && description) {
          const first = description.split(/(?<=[.!?])\s+/)[0]?.trim();
          summary = first && first.length <= 140 ? first : `${description.slice(0, 120).trim()}…`;
        }
        return {
          roleTitle: String(r.roleTitle || "").trim(),
          matchPercentage: Math.round(Number(r.matchPercentage) || 0),
          summary,
          description,
          tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [],
        };
      });
    }

    const recommendation = await persistRecommendation({
      userId,
      profileHash,
      assessmentId: latestAssessment?._id,
      profile: profileForMatch,
      roles: normalized,
      catalogVersion,
      promptVersion: MATCH_PROMPT_VERSION,
      engineVersion: MATCH_ENGINE,
      notice: profileNotice,
      personalAnswer,
    });
    if (!recommendation || recommendation.roles?.length !== 5) {
      throw new Error("Durable role recommendation persistence was incomplete");
    }
    if (deferredSuccessUsage) {
      await recordAiUsage(deferredSuccessUsage);
      deferredSuccessUsage = null;
    }

    // Persist to cache so an identical re-run is free and byte-identical.
    await AiMatchResult.findOneAndUpdate(
      { userId, profileHash },
      { $set: { engineVersion: MATCH_ENGINE, endpoint: "match-roles", roles: normalized } },
      { upsert: true }
    ).catch((e) => console.error("[ai/match-roles] cache write failed:", e?.message));

    // Append-only history so users can reopen past generations.
    const top = normalized[0];
    await MatchGeneration.create({
      userId,
      profileHash,
      engineVersion: MATCH_ENGINE,
      roles: normalized,
      topRole: top?.roleTitle || "",
      topMatch: top?.matchPercentage ?? null,
    }).catch((e) => console.error("[ai/match-roles] history write failed:", e?.message));

    const access = await getRecommendationAccessForUser(userId, {
      userRole: user?.role,
    });
    const serialized = serializeRecommendation(recommendation, access);

    res.json(serialized);
  } catch (err) {
    if (deferredSuccessUsage) {
      await recordAiUsage({
        ...deferredSuccessUsage,
        status: "persistence_error",
        errorMessage: err?.message || "Durable recommendation persistence failed",
      });
    } else if (!failureUsageRecorded) {
      await recordAiUsage({
        userId,
        userEmail,
        endpoint: "match-roles",
        model: AI_MODEL,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        status: "api_error",
        filteredRoleCount,
        errorMessage: err?.message || "Unknown error",
      });
    }
    if (err?.status === 401) {
      return res.status(503).json({ error: "AI API key is invalid or missing." });
    }
    return sendServerError(res, err, "[ai/match-roles]");
  }
}
