/** Values persisted to `Preferences.combatPreference` (excludes legacy + Undecided for new picks). */
export type CombatPreferenceValue = "FieldCombat" | "SupportHQ" | "TechTrack" | "MedicalInstruction" | "Mixed";

export type FocusPreferenceValue = "Tech" | "Physical" | "Research" | "Medical";

export type FitnessPreferenceValue = "Low" | "Medium" | "High";

export const COMBAT_PREFERENCE_OPTIONS: { value: CombatPreferenceValue; title: string; subtitle: string }[] = [
  {
    value: "FieldCombat",
    title: "כיוון קרבי / שטח",
    subtitle: "לחימה, חי״ר ושריון, סיור, יחידות מיוחדות",
  },
  {
    value: "SupportHQ",
    title: "שירות תומך / מפקדה",
    subtitle: "מנהלה, לוגיסטיקה, כ״א, תפעול, מטה",
  },
  {
    value: "TechTrack",
    title: "טכנולוגיה ומודיעין",
    subtitle: "פיתוח, סייבר, תקשוב, מערכות מידע",
  },
  {
    value: "MedicalInstruction",
    title: "רפואה / חינוך / הדרכה",
    subtitle: "שירות מקצועי מחוץ ללחימה ישירה",
  },
  {
    value: "Mixed",
    title: "פתוח/ה לכמה סוגים",
    subtitle: "גם שטח וגם מפקדה, נבדוק מה מתאים",
  },
];

export const FOCUS_PREFERENCE_OPTIONS: { value: FocusPreferenceValue; title: string; subtitle: string }[] = [
  { value: "Tech", title: "טכנולוגיה", subtitle: "מחשבים, סייבר, מערכות" },
  { value: "Physical", title: "אתגר פיזי", subtitle: "כושר, שטח, עבודה גופנית" },
  { value: "Research", title: "מחקר / אנליזה", subtitle: "חשיבה, תכנון, ניתוח" },
  { value: "Medical", title: "רפואה / טיפול", subtitle: "רפואה, פראמדיק, שירות רפואי" },
];

export const FITNESS_PREFERENCE_OPTIONS: { value: FitnessPreferenceValue; title: string; subtitle: string }[] = [
  { value: "Low", title: "בסיסי", subtitle: "מתחילים או רמת כושר נמוכה" },
  { value: "Medium", title: "בינוני", subtitle: "רוב המגויסים" },
  { value: "High", title: "גבוה", subtitle: "כושר קרבי / ספורטיבי" },
];

/** Dashboard / AI counselor copy for `aiProfileMissing` keys from the API */
export const AI_PROFILE_MISSING_LABELS: Record<string, string> = {
  daparScore: 'דפ״ר',
  medicalProfile: "פרופיל רפואי",
  yomHameah: "ציוני מא״ה (כל הממדים)",
  draftDate: "תאריך גיוס משוער",
  combatPreference: "כיוון שירות (קרבי / מפקדה / טכנולוגיה וכו׳)",
  focus: "מיקוד תפקידי",
  physicalActivityLevel: "רמת כושר (הערכה עצמית)",
};
