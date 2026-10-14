import { getIdfRoleCatalogV3, getRoleEnrichmentOverride } from "./roleCatalogV3.js";
import { officialSourceUrl } from "./rolePage.js";

const MITGAISIM_ROLES = "https://www.mitgaisim.idf.il/roles/";

const TAG_HE = {
  editing: "עריכה",
  video: "וידאו",
  photography: "צילום",
  design: "עיצוב",
  animation: "אנימציה",
  writing: "כתיבה",
  content: "תוכן",
  "social-media": "רשתות חברתיות",
  coding: "תכנות",
  software: "תוכנה",
  qa: "בדיקות תוכנה",
  devops: "DevOps",
  cyber: "סייבר",
  networks: "רשתות",
  it: "מחשוב",
  data: "נתונים",
  ai: "בינה מלאכותית",
  electronics: "אלקטרוניקה",
  hardware: "חומרה",
  intelligence: "מודיעין",
  research: "מחקר",
  languages: "שפות",
  arabic: "ערבית",
  english: "אנגלית",
  maps: "מפות",
  "visual-analysis": "ניתוח חזותי",
  "attention-to-detail": "דיוק",
  math: "מתמטיקה",
  physics: "פיזיקה",
  chemistry: "כימיה",
  biology: "ביולוגיה",
  medicine: "רפואה",
  emergency: "חירום",
  dentistry: "רפואת שיניים",
  lab: "מעבדה",
  "helping-people": "עזרה לאנשים",
  teaching: "הדרכה",
  "public-speaking": "הופעה מול קהל",
  leadership: "מנהיגות",
  hr: "משאבי אנוש",
  welfare: "רווחה",
  psychology: "פסיכולוגיה",
  interviewing: "ראיונות",
  admin: "מנהלה",
  law: "משפטים",
  operations: "מבצעים",
  "war-room": "חמ״ל",
  aviation: "תעופה",
  drones: "כטב״ם",
  sea: "ים",
  fieldwork: "שטח",
  fitness: "כושר",
  combat: "קרבי",
  animals: "בעלי חיים",
  rescue: "חילוץ",
  logistics: "לוגיסטיקה",
  driving: "נהיגה",
  mechanics: "מכונאות",
  construction: "הנדסה/בינוי",
  budget: "תקציב",
  service: "שירות",
  religion: "דת",
  music: "מוזיקה",
  sports: "ספורט",
  creative: "יצירה",
};

/** Stable URL slug from Hebrew (or mixed) role title. */
export function roleSlug(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\u0590-\u05FFa-z0-9\-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "role";
}

function tagsHe(tags = []) {
  return tags.map((t) => TAG_HE[t] || t).filter(Boolean);
}

function buildAboutHe(role) {
  const title = role.roleTitle;
  const category = role.category || "כללי";
  const signals = Array.isArray(role.signals) ? role.signals.filter(Boolean) : [];
  const tagLabels = tagsHe(role.preferenceTags || []);
  const parts = [];

  parts.push(
    `${title} שייך לקטגוריית «${category}». ` +
      (role.combat
        ? "זהו כיוון עם מאפיינים קרביים/שדה, ולכן חשוב לבדוק פרופיל רפואי והתאמה אישית מול גורמי הגיוס."
        : "זהו כיוון מקצועי/עורפי יחסית, עם דגש על מיומנויות מקצועיות וסביבת עבודה ייעודית.")
  );

  if (role.selective) {
    parts.push("הקבלה לתפקיד נחשבת סלקטיבית: יש ביקוש גבוה וסינון לפי נתונים, העדפות וצורכי הצבא.");
  }

  if (signals.length) {
    parts.push(`בשגרה עוסקים בין היתר ב: ${signals.join(", ")}.`);
  }

  if (tagLabels.length) {
    parts.push(`תחומי עניין שמתחברים לתפקיד: ${tagLabels.slice(0, 8).join(", ")}.`);
  }

  if (role.dayToDay && String(role.dayToDay).trim()) {
    parts.push(String(role.dayToDay).trim());
  }

  if (role.daparFloor != null || role.medicalFloor != null) {
    const bits = [];
    if (role.daparFloor != null) bits.push(`דפ״ר מינימלי משוער: ${role.daparFloor}`);
    if (role.medicalFloor != null) bits.push(`פרופיל רפואי מינימלי משוער: ${role.medicalFloor}`);
    parts.push(`${bits.join(". ")}. הנתונים להכוונה בלבד ואינם מחליפים את דרישות הצבא הרשמיות.`);
  }

  parts.push(
    "המידע כאן נועד להכוונה כללית בלבד. השמות, הדרישות והפתיחות משתנים. תמיד אמתו מול אתר מתגייסים הרשמי של צה״ל ולשכת הגיוס."
  );

  return parts.join("\n\n");
}

function toPublicInsight(role) {
  const title = role.roleTitle;
  // Normalized roles carry derived defaults; page facts read only what the data states.
  const override = getRoleEnrichmentOverride(title) || {};
  return {
    slug: roleSlug(title),
    roleTitle: title,
    category: role.category || "",
    combat: Boolean(role.combat),
    selective: Boolean(role.selective),
    signals: Array.isArray(role.signals) ? role.signals : [],
    tags: Array.isArray(role.preferenceTags) ? role.preferenceTags : [],
    tagsHe: tagsHe(role.preferenceTags || []),
    about: buildAboutHe(role),
    dayToDay: role.dayToDay || "",
    requirements: Array.isArray(role.requirements) ? role.requirements : [],
    locations: Array.isArray(role.locations) ? role.locations : [],
    serviceLengthLabel: role.serviceLengthLabel || "",
    daparFloor: role.daparFloor ?? null,
    medicalFloor: role.medicalFloor ?? null,
    physicalDemand: role.physicalDemand ?? null,
    techIntensity: role.techIntensity ?? null,
    peopleIntensity: role.peopleIntensity ?? null,
    genderEligibility: override.genderEligibility || null,
    intensityFromData: override.physicalDemand != null,
    sourceUrl: officialSourceUrl(override.enrichment?.source, role.validationSource),
    officialDirectoryUrl: MITGAISIM_ROLES,
    officialSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${title}" site:mitgaisim.idf.il`)}`,
  };
}

let cachedList;

export function listRoleInsights() {
  if (cachedList) return cachedList;
  const catalog = getIdfRoleCatalogV3();
  const roles = (catalog?.roles || []).map(toPublicInsight);
  // Stable sort by Hebrew title
  roles.sort((a, b) => a.roleTitle.localeCompare(b.roleTitle, "he"));
  cachedList = roles;
  return cachedList;
}

export function getRoleInsightBySlug(slug) {
  const needle = String(slug || "").trim().toLowerCase();
  if (!needle) return null;
  return listRoleInsights().find((r) => r.slug === needle) || null;
}

export function getRoleInsightByTitle(title) {
  const needle = String(title || "").trim();
  if (!needle) return null;
  return listRoleInsights().find((r) => r.roleTitle === needle) || getRoleInsightBySlug(roleSlug(needle));
}

export function _resetRoleInsightsCache() {
  cachedList = undefined;
}
