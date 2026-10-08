/** Must stay aligned with server/utils/yomHameahKeys.js. The 11 real יום המא"ה scores. */

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
] as const;

export type YomHameahKey = (typeof YOM_HAMEAH_KEYS)[number];

export type YomHameah = Record<YomHameahKey, number>;

export const YOM_HAMEAH_LABELS_HE: Record<YomHameahKey, string> = {
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

const LEGACY_5 = ["teamwork", "management", "technical", "field", "dataProcessing"] as const;

const score = (v: unknown): v is number => typeof v === "number" && v >= 1 && v <= 5;
const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v)));

export function isValidYomHameah(y: unknown): y is YomHameah {
  if (!y || typeof y !== "object") return false;
  const o = y as Record<string, unknown>;
  return YOM_HAMEAH_KEYS.every((k) => score(o[k]));
}

/** Any stored shape (current 11, previous 12 with disciplineMaturity, original 5) → 11 keys. */
export function migrateLegacyYomHameah(y: unknown): YomHameah | null {
  if (!y || typeof y !== "object") return null;
  const o = y as Record<string, number>;
  if (isValidYomHameah(o)) {
    return Object.fromEntries(YOM_HAMEAH_KEYS.map((k) => [k, o[k]])) as YomHameah;
  }
  if (score(o.disciplineMaturity)) {
    const base = Object.fromEntries(
      YOM_HAMEAH_KEYS.filter((k) => k !== "frameworkBehavior" && k !== "maturity").map((k) => [k, o[k]]),
    );
    if (!Object.values(base).every(score)) return null;
    return { ...base, frameworkBehavior: o.disciplineMaturity, maturity: o.disciplineMaturity } as YomHameah;
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

export function defaultYomHameahScores(): YomHameah {
  return Object.fromEntries(YOM_HAMEAH_KEYS.map((k) => [k, 3])) as YomHameah;
}
