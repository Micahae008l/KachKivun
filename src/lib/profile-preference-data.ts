/** Values persisted to `Preferences.combatPreference` (excludes legacy + Undecided for new picks). */
export type CombatPreferenceValue = "FieldCombat" | "SupportHQ" | "TechTrack" | "MedicalInstruction" | "Mixed";

export type FocusPreferenceValue = "Tech" | "Physical" | "Research" | "Medical";

export type FitnessPreferenceValue = "Low" | "Medium" | "High";

export const COMBAT_PREFERENCE_OPTIONS: { value: CombatPreferenceValue; title: string; subtitle: string }[] = [
  {
    value: "FieldCombat",
    title: "כיוון קרבי / שטח",
    subtitle: "לחימה, גיסריות, סיור, יחידות מיוחדות",
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

// ── Personal questions ────────────────────────────────────────────────────────
// Optional answers the AI match weighs. Each option's `reaction` shows under the grid
// once picked: it says what the match will do with the answer, never an invented statistic.

export type MotivationValue = "Impact" | "Profession" | "Challenge" | "NearHome" | "Team";
export type StrengthValue = "Tech" | "People" | "HandsOn" | "Analysis" | "Sport";
export type EnvironmentValue = "Field" | "Base" | "Sea" | "Air" | "Any";
export type LanguageValue = "English" | "Arabic" | "Russian" | "French" | "Amharic" | "Spanish" | "Other" | "HebrewOnly";

export type PersonalOption<T extends string> = { value: T; title: string; subtitle: string; reaction: string };

export const MOTIVATION_OPTIONS: PersonalOption<MotivationValue>[] = [
  {
    value: "Impact",
    title: "השפעה ומשמעות",
    subtitle: "לעשות משהו שמרגישים את התוצאה שלו",
    reaction: "נעדיף תפקידים שבהם רואים מקרוב את התוצאה של העבודה שלכם.",
  },
  {
    value: "Profession",
    title: "מקצוע לאזרחות",
    subtitle: "משהו שיעזור בלימודים ובעבודה אחר כך",
    reaction: "נשים לב לתפקידים עם הכשרה שאפשר לקחת הלאה, כמו טכנולוגיה, רפואה והנדסה.",
  },
  {
    value: "Challenge",
    title: "אתגר",
    subtitle: "להוכיח לעצמי שאני יכול/ה",
    reaction: "נחפש תפקידים עם מסלול הכשרה תובעני, מהסוג שזוכרים כל החיים.",
  },
  {
    value: "NearHome",
    title: "קרוב לבית",
    subtitle: "לחזור הביתה לעיתים קרובות",
    reaction: "ניתן משקל לתפקידים עם יציאות תכופות או שירות יומי.",
  },
  {
    value: "Team",
    title: "צוות וחברים",
    subtitle: "אנשים טובים סביבי זה הכי חשוב",
    reaction: "נעדיף תפקידים שעובדים בהם בצוות קטן ומגובש.",
  },
];

export const STRENGTH_OPTIONS: PersonalOption<StrengthValue>[] = [
  {
    value: "Tech",
    title: "טכנולוגיה ומחשבים",
    subtitle: "קוד, משחקים, לפרק ולהרכיב",
    reaction: "זה אות חזק לתפקידי טכנולוגיה, סייבר ותקשוב. נבדוק אותו מול הדפ״ר שלכם.",
  },
  {
    value: "People",
    title: "אנשים והדרכה",
    subtitle: "להסביר, להוביל, להקשיב",
    reaction: "תפקידי הדרכה, פיקוד ותפקידים מול אנשים יקבלו אצלנו משקל.",
  },
  {
    value: "HandsOn",
    title: "עבודת ידיים",
    subtitle: "לתקן, לבנות, מכונות",
    reaction: "נסתכל גם על תפקידי טכנאות, חימוש ואחזקה.",
  },
  {
    value: "Analysis",
    title: "ניתוח וחשיבה",
    subtitle: "מספרים, חידות, התמונה הגדולה",
    reaction: "זה מתאים במיוחד לתפקידי מודיעין ומחקר.",
  },
  {
    value: "Sport",
    title: "ספורט וכושר",
    subtitle: "להתאמן, לזוז, לא לשבת במקום",
    reaction: "תפקידי שטח ותפקידים עם דרישות כושר יקבלו משקל, בהתאם לפרופיל הרפואי.",
  },
];

export const ENVIRONMENT_OPTIONS: PersonalOption<EnvironmentValue>[] = [
  { value: "Field", title: "שטח", subtitle: "בחוץ ובתנועה", reaction: "נעדיף תפקידי שטח ותנועה." },
  { value: "Base", title: "בסיס / משרד", subtitle: "סביבה קבועה ומסודרת", reaction: "נעדיף תפקידים בבסיס קבוע." },
  { value: "Sea", title: "ים", subtitle: "ספינות, צלילה, חוף", reaction: "נבדוק גם תפקידים בחיל הים." },
  { value: "Air", title: "אוויר", subtitle: "מטוסים, מסוקים, בסיסי חיל האוויר", reaction: "נבדוק גם תפקידים בחיל האוויר." },
  { value: "Any", title: "לא משנה", subtitle: "פתוח/ה לכל מקום", reaction: "מעולה, זה משאיר לנו יותר אפשרויות." },
];

export const LANGUAGE_OPTIONS: { value: LanguageValue; title: string; subtitle: string }[] = [
  { value: "English", title: "אנגלית", subtitle: "ברמה טובה" },
  { value: "Arabic", title: "ערבית", subtitle: "שיחה או קריאה" },
  { value: "Russian", title: "רוסית", subtitle: "" },
  { value: "French", title: "צרפתית", subtitle: "" },
  { value: "Amharic", title: "אמהרית", subtitle: "" },
  { value: "Spanish", title: "ספרדית", subtitle: "" },
  { value: "Other", title: "שפה אחרת", subtitle: "" },
  { value: "HebrewOnly", title: "עברית בלבד", subtitle: "גם זה בסדר גמור" },
];

/** The reaction line for a set of languages: the most useful signal wins. */
export function languagesReaction(langs: LanguageValue[]): string {
  if (!langs.length) return "";
  if (langs.includes("Arabic")) return "ערבית היא יתרון אמיתי בתפקידי מודיעין, נבדוק את הכיוון הזה.";
  if (langs.some((l) => l !== "English" && l !== "HebrewOnly")) return "שפה נוספת יכולה לפתוח תפקידי מודיעין וקשר.";
  if (langs.includes("English")) return "אנגלית טובה עוזרת בתפקידי טכנולוגיה ומודיעין.";
  return "אין בעיה, רוב התפקידים לא דורשים שפה נוספת.";
}
