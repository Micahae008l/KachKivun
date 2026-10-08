import {
  COMBAT_PREFERENCE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
} from "@/lib/profile-preference-data";
import type {
  CombatReadiness,
  DaparScore,
  EnvironmentPreference,
  BasePreference,
  LeadershipPreference,
  MedicalProfile,
  Motivation,
  PullUpsBand,
  PushUpsBand,
  RoleAvoidance,
  RoleInterest,
  Run3kmBand,
  StressPreference,
  TechnicalArea,
  TechnicalLevel,
} from "./types";

export type AssessmentOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export { COMBAT_PREFERENCE_OPTIONS, FITNESS_PREFERENCE_OPTIONS, FOCUS_PREFERENCE_OPTIONS };

export const DAPAR_SCORES: readonly DaparScore[] = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const MEDICAL_PROFILES: readonly MedicalProfile[] = [21, 45, 64, 70, 72, 82, 97];
export const UNKNOWN_SCORE_VALUE = "unknown" as const;
export const UNKNOWN_SCORE_LABEL = "לא יודע/ת כרגע";

export const YOM_SOURCE_OPTIONS = [
  {
    value: "official",
    label: "ציונים רשמיים",
    description: "הציונים שקיבלתם בתוצאות מא״ה",
  },
  {
    value: "self",
    label: "הערכה עצמית",
    description: "אין עדיין תוצאות; בחירה זו מאשרת אומדן זהיר שאפשר לכוון למטה",
  },
  {
    value: "unknown",
    label: "לא יודע/ת להעריך",
    description: "לא נבקש 11 ציונים; נשמור ערכים ניטרליים שלא ישמשו כאות זכאות",
  },
] as const;

export const ROLE_INTEREST_OPTIONS: readonly AssessmentOption<RoleInterest>[] = [
  { value: "cyber", label: "8200 / סייבר" },
  { value: "combat", label: "לוחמה / קרבי" },
  { value: "intelligence", label: "מודיעין" },
  { value: "technology_engineering", label: "טכנולוגיה / הנדסה" },
  { value: "medical", label: "רפואה / פרמדיק" },
  { value: "air_force", label: "חיל האוויר" },
  { value: "navy", label: "חיל הים" },
  { value: "instruction_education", label: "הדרכה / חינוך" },
  { value: "logistics", label: "לוגיסטיקה" },
  { value: "undecided", label: "עדיין לא יודע/ת" },
];

export const ROLE_AVOIDANCE_OPTIONS: readonly AssessmentOption<RoleAvoidance>[] = [
  { value: "kitchen_maintenance", label: "מטבח / תחזוקה" },
  { value: "guard_duty_nights", label: "שמירות / לילות" },
  { value: "far_from_home", label: "רחוק מהבית" },
  { value: "office_only", label: "רק משרד" },
  { value: "too_physical", label: "פיזי מדי" },
  { value: "monotonous", label: "מונוטוני / משעמם" },
];

export const BASE_OPTIONS: readonly AssessmentOption<BasePreference>[] = [
  { value: "open", label: "בסיס פתוח: חוזרים הביתה בערב" },
  { value: "closed", label: "בסיס סגור: ישנים בבסיס, יוצאים בסופ״ש או לפי סבב" },
  { value: "no_preference", label: "לא משנה לי" },
];

export const ENVIRONMENT_OPTIONS: readonly AssessmentOption<EnvironmentPreference>[] = [
  { value: "office", label: "משרד / מסך" },
  { value: "field", label: "שטח / חוץ" },
  { value: "mixed", label: "שילוב" },
  { value: "no_preference", label: "לא משנה לי" },
];

export const LEADERSHIP_OPTIONS: readonly AssessmentOption<LeadershipPreference>[] = [
  { value: "want_lead", label: "רוצה לפקד" },
  { value: "open", label: "פתוח/ה אם יציעו" },
  { value: "prefer_team", label: "מעדיף/ה להיות חלק מצוות" },
];

export const STRESS_OPTIONS: readonly AssessmentOption<StressPreference>[] = [
  { value: "high", label: "מתפקד/ת טוב תחת לחץ" },
  { value: "moderate", label: "מסתדר/ת, לא מחפש/ת עומס" },
  { value: "low", label: "מעדיף/ה סביבה רגועה" },
];

export const RUN_3KM_OPTIONS: readonly AssessmentOption<Run3kmBand>[] = [
  { value: "unknown", label: "לא יודע/ת" },
  { value: "over_15", label: "מעל 15 דקות" },
  { value: "13_to_15", label: "13–15 דקות" },
  { value: "under_13", label: "מתחת ל־13 דקות" },
];

export const PULL_UP_OPTIONS: readonly AssessmentOption<PullUpsBand>[] = [
  { value: "unknown", label: "לא יודע/ת" },
  { value: "0_to_5", label: "0–5" },
  { value: "6_to_15", label: "6–15" },
  { value: "16_plus", label: "16+" },
];

export const PUSH_UP_OPTIONS: readonly AssessmentOption<PushUpsBand>[] = [
  { value: "unknown", label: "לא יודע/ת" },
  { value: "0_to_30", label: "0–30" },
  { value: "31_to_60", label: "31–60" },
  { value: "61_plus", label: "61+" },
];

export const COMBAT_READINESS_OPTIONS: readonly AssessmentOption<CombatReadiness>[] = [
  { value: "ready", label: "מרגיש/ה מוכן/ה פיזית" },
  { value: "needs_improvement", label: "במצב בינוני, צריך שיפור" },
  { value: "wants_to_improve", label: "עוד לא שם, רוצה להשתפר" },
  { value: "unsure", label: "לא בטוח/ה עדיין" },
];

export const TECH_LEVEL_OPTIONS: readonly AssessmentOption<TechnicalLevel>[] = [
  { value: "none", label: "כמעט ללא ניסיון" },
  { value: "basic", label: "בסיסי" },
  { value: "intermediate", label: "בינוני, כתבתי קצת קוד" },
  { value: "advanced", label: "גבוה, בניתי פרויקטים" },
  { value: "expert", label: "מתקדם מאוד / CTF" },
];

export const TECH_AREA_OPTIONS: readonly AssessmentOption<TechnicalArea>[] = [
  { value: "programming", label: "תכנות" },
  { value: "cybersecurity", label: "סייבר / אבטחה" },
  { value: "networks", label: "רשתות" },
  { value: "data_ai", label: "דאטה / AI" },
  { value: "hardware_electronics", label: "חומרה / אלקטרוניקה" },
  { value: "undecided", label: "עדיין לא יודע/ת" },
];

export const MOTIVATION_OPTIONS: readonly AssessmentOption<Motivation>[] = [
  { value: "contribution", label: "תרומה למדינה" },
  { value: "challenge", label: "אתגר" },
  { value: "career", label: "מקצוע להמשך" },
  { value: "friends_experience", label: "חברים / חוויה" },
  { value: "personal_growth", label: "לגדול ולהתפתח" },
  { value: "unsure", label: "עוד לא בטוח/ה" },
];
