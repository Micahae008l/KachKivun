/**
 * 11 ציוני יום המא״ה (מיון, איתור והתאמה), סולם 1-5, לפי גיליון הציונים בפועל:
 * סביבת הדרכה, טיפול באדם, טכני-פעולה, מנהל וארגון, עיבוד מידע, פיקוד, עבודת צוות,
 * השקעה והתמדה, התנהגות מסגרתית, בגרות ובשלות, תפיסה מרחבית.
 * Keep aligned with src/lib/yom-hameah.ts.
 * @type {readonly string[]}
 */
export const YOM_HAMEAH_KEYS = [
  "technicalActivation",
  "spatialPerception",
  "dataProcessing",
  "teamwork",
  "command",
  "instruction",
  "interpersonalCare",
  "diligencePersistence",
  "managementOrganization",
  "frameworkBehavior",
  "maturity",
];

/** @type {Record<string, string>} */
export const YOM_HAMEAH_LABELS_HE = {
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

const LEGACY_5 = ["teamwork", "management", "technical", "field", "dataProcessing"];
/** The previous 12-key shape had two dimensions that are not real מא"ה scores and one merged key. */
const LEGACY_12_MARKER = "disciplineMaturity";

const score = (v) => typeof v === "number" && v >= 1 && v <= 5;
const clamp = (v) => Math.max(1, Math.min(5, Math.round(v)));

/** @param {unknown} y */
export function isValidYomHameah(y) {
  if (!y || typeof y !== "object") return false;
  const o = /** @type {Record<string, unknown>} */ (y);
  return YOM_HAMEAH_KEYS.every((k) => score(o[k]));
}

/**
 * Normalizes any stored shape (current 11, previous 12, original 5) to the 11 keys.
 * @param {unknown} y
 * @returns {Record<string, number>|null}
 */
export function migrateLegacyYomHameah(y) {
  if (!y || typeof y !== "object") return null;
  const o = /** @type {Record<string, number>} */ (y);
  if (isValidYomHameah(o)) {
    return Object.fromEntries(YOM_HAMEAH_KEYS.map((k) => [k, o[k]]));
  }
  if (score(o[LEGACY_12_MARKER])) {
    const base = Object.fromEntries(
      YOM_HAMEAH_KEYS.filter((k) => k !== "frameworkBehavior" && k !== "maturity").map((k) => [k, o[k]]),
    );
    if (!Object.values(base).every(score)) return null;
    return { ...base, frameworkBehavior: o.disciplineMaturity, maturity: o.disciplineMaturity };
  }
  if (!LEGACY_5.every((k) => score(o[k]))) return null;
  const t = o.technical;
  const f = o.field;
  const d = o.dataProcessing;
  const tw = o.teamwork;
  const m = o.management;
  return {
    technicalActivation: t,
    spatialPerception: f,
    dataProcessing: d,
    teamwork: tw,
    command: m,
    instruction: m,
    interpersonalCare: clamp((tw + m) / 2),
    diligencePersistence: m,
    managementOrganization: m,
    frameworkBehavior: m,
    maturity: m,
  };
}
