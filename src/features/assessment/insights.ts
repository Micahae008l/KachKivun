import { YOM_HAMEAH_KEYS, YOM_HAMEAH_LABELS_HE, type YomHameahKey } from "@/lib/yom-hameah";
import type { AssessmentAnswers } from "./types";

/**
 * Everything the checkpoint and review screens visualize, derived only from the user's answers.
 * Thresholds come from official mitgaisim.idf.il pages; see docs/IDF-FACTS-AND-SITE-GAPS.md.
 */

const TECH_INTERESTS = new Set(["cyber", "intelligence", "technology_engineering"]);

const num = (v: number | "unknown" | null): number | null => (typeof v === "number" ? v : null);

export function wantsTech(a: AssessmentAnswers): boolean {
  return a.combatPreference === "TechTrack" || a.focus === "Tech" || a.focus === "Research" || a.rolesInterested.some((r) => TECH_INTERESTS.has(r));
}

export function wantsCombat(a: AssessmentAnswers): boolean {
  return a.combatPreference === "FieldCombat" || a.combatPreference === "Mixed" || a.rolesInterested.includes("combat");
}

/** A man with profile 72+ is "מיועד ללוחמה": rear roles are not in his questionnaire. */
export function isCombatDesignatedMale(a: AssessmentAnswers): boolean {
  const medical = num(a.medicalProfile);
  return a.gender === "male" && medical != null && medical >= 72;
}

// ---------- דפ"ר doors ----------

export type DaparDoor = { dapar: number; items: string[] };

export function daparDoors(a: AssessmentAnswers): DaparDoor[] {
  const medical = num(a.medicalProfile) ?? 0;
  const combatMale = isCombatDesignatedMale(a);
  const female = a.gender === "female";
  const tech = wantsTech(a);
  const intel = a.rolesInterested.includes("intelligence") || a.rolesInterested.includes("cyber");
  const combat = wantsCombat(a);
  const air = a.rolesInterested.includes("air_force");
  const doors = new Map<number, string[]>();
  const add = (d: number, item: string) => doors.set(d, [...(doors.get(d) ?? []), item]);

  if (combat && medical >= 82 && (!female || medical >= 97)) add(50, "יום סיירות (מטכ״ל, שלדג, שייטת)");
  if (intel) add(50, "מסלולי שפות: ערבית, פרסית, אופק");
  if (tech || intel) add(60, "גאמ״א סייבר");
  if (intel && !combatMale) add(60, "יום מיון כלל חמ״ן");
  if (tech && !combatMale) add(60, "אשכול מקצועות המחשב: QA, דאטה, מיישם הגנה");
  if ((air || combat) && medical >= 97) add(60, "קורס טיס");
  if (combat && medical >= 82 && (a.rolesInterested.includes("navy") || air)) add(60, "חובלים, צוללות");
  if (tech && !combatMale) add(70, "תוכניתן, מגן סייבר, DevOps, לה״ב");
  if (tech || a.focus === "Research") add(70, "עתודה עילית: פסגות, אלונים, ברקים");
  if (tech && combatMale) add(80, "אשכול מקצועות המחשב לבעלי פרופיל קרבי (+10 יח״ל)");
  if (tech || intel) add(80, "שחקים: אמנון, אח״מ, אע״מ (8200)");
  if (tech || a.focus === "Research") add(90, "תלפיות");

  return [...doors.entries()].sort((x, y) => y[0] - x[0]).map(([dapar, items]) => ({ dapar, items }));
}

// ---------- profile ladder ----------

export type ProfileRung = { profile: number; opens: string };

export const PROFILE_RUNGS: ProfileRung[] = [
  { profile: 97, opens: "הכול, כולל 669 וטיס" },
  { profile: 82, opens: "חי״ר, סיירות, הנדסה קרבית, מג״ב, שייטת, מטכ״ל" },
  { profile: 72, opens: "שריון, תותחנים, הגנה אווירית, חילוץ, חי״ר גבולות" },
  { profile: 70, opens: "תותחנים, הגנה אווירית, חיל האוויר (חדש, 2026)" },
  { profile: 64, opens: "תומכי לחימה, לוחם מעברים, מ״כ" },
  { profile: 45, opens: "תפקידי עורף" },
];

// ---------- מא"ה ----------

const DIMENSION_OPENS: Record<YomHameahKey, string> = {
  technicalActivation: "טכנאות, תקשוב, מערכות",
  spatialPerception: "ניווט, הטסה, בקרה, שטח",
  dataProcessing: "מודיעין, ניתוח, סייבר",
  teamwork: "צוותי שדה, יחידות מבצעיות",
  command: "פיקוד וקצונה",
  instruction: "מדריכים ומ״כים",
  interpersonalCare: "רפואה, ת״ש, משא״ן",
  diligencePersistence: "קורסים ארוכים ומסלולי עילית",
  managementOrganization: "חמ״ל, מטה, לוגיסטיקה",
  frameworkBehavior: "תפקידים מסווגים",
  maturity: "תפקידים רגישים, אחריות",
};

export type DimensionRow = { key: YomHameahKey; label: string; score: number; opens: string; top: boolean };

export function dimensionRows(a: AssessmentAnswers): { rows: DimensionRow[]; flat: boolean } {
  const rows = YOM_HAMEAH_KEYS.map((key) => ({
    key,
    label: YOM_HAMEAH_LABELS_HE[key],
    score: a.yomHameah[key],
    opens: DIMENSION_OPENS[key],
    top: false,
  })).sort((x, y) => y.score - x.score);
  const flat = rows.every((r) => r.score === rows[0].score);
  if (!flat) rows.filter((r) => r.score === rows[0].score && r.score >= 4).slice(0, 3).forEach((r) => (r.top = true));
  return { rows, flat };
}

// ---------- commitment timeline ----------

export type CommitmentRow = { label: string; mandatory: number; keva: number; release: Date; end: Date };

const addMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() + m, 1);

export function commitmentRows(a: AssessmentAnswers): CommitmentRow[] {
  const draft = new Date(a.draftDate);
  if (Number.isNaN(draft.getTime())) return [];
  const female = a.gender === "female";
  const rows: [string, number, number][] = [];
  if (wantsTech(a)) {
    rows.push(["תוכניתן/ית", 32, 30], ["מגן/ת סייבר", 32, 24], ["DevOps", 32, 12], ["גאמ״א / אמנון", 32, 36]);
    if (num(a.daparScore) === 90) rows.push(["תלפיות (כולל תואר)", 40, 72]);
  }
  if (wantsCombat(a)) {
    if (female) rows.push(["לוחמת", 32, 0], ["תפקיד עורפי", 24, 0]);
    else rows.push(["לוחם", 32, 0], ["שלדג (+קבע)", 36, 18]);
  }
  if (!rows.length) rows.push([female ? "שירות רגיל" : "שירות חובה", female ? 24 : 32, 0]);
  return rows.slice(0, 5).map(([label, mandatory, keva]) => ({
    label,
    mandatory,
    keva,
    release: addMonths(draft, mandatory),
    end: addMonths(draft, mandatory + keva),
  }));
}

export const formatMonth = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

// ---------- roadmap with real dates ----------

export type RoadmapStatus = "past" | "now" | "upcoming";
export type RoadmapItem = { date: Date; title: string; detail: string; status: RoadmapStatus; approx?: boolean };

function statusFor(date: Date, today: Date): RoadmapStatus {
  const months = (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
  if (months < 0) return "past";
  if (months === 0) return "now";
  return "upcoming";
}

/** Next occurrence of any of the given months (1-12) between `from` and `until`. */
function nextOf(monthsOfYear: number[], from: Date, until: Date): Date | null {
  for (let i = 0; i < 24; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    if (d >= until) return null;
    if (monthsOfYear.includes(d.getMonth() + 1)) return d;
  }
  return null;
}

export function monthsUntil(date: Date, today = new Date()): number {
  return (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
}

export function draftRoadmap(a: AssessmentAnswers, today = new Date()): RoadmapItem[] {
  const draft = new Date(a.draftDate);
  if (Number.isNaN(draft.getTime()) || draft <= today) return [];
  const dm = draft.getMonth() + 1;
  const dy = draft.getFullYear();
  const g12 = dm >= 7 ? dy - 1 : dy - 2; // year grade 12 starts (September)
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const medical = num(a.medicalProfile) ?? 0;
  const items: Omit<RoadmapItem, "status">[] = [];
  const push = (date: Date | null, title: string, detail: string, approx = false) => {
    if (date) items.push({ date, title, detail, approx });
  };

  push(new Date(g12, 8, 1), "שאלון העדפות נפתח", "דרגו עד 3 יעדים בציון 3 ומעלה; תפקידי איתור דורשים מיון.");
  if (wantsTech(a) || a.rolesInterested.includes("intelligence")) {
    push(nextOf([1, 7], thisMonth, draft), "מיוני אשכול מקצועות המחשב", "יום מקוון ויום פרונטלי; תוצאות תוך 3 עד 6 שבועות.", true);
    if (!isCombatDesignatedMale(a)) {
      const wave = dm >= 7 && dm <= 11 ? new Date(dy - 1, 5, 1) : new Date(dm === 12 ? dy : dy - 1, 1, 1);
      push(wave, "גל מיוני כלל חמ״ן", "לא הוזמנתם? מיטב 1111, שלוחה 1 ואז 2.", true);
    }
    push(new Date(g12 + 1, 1, 28), "סגירת שאלון העתודה האקדמית", "פסיכומטרי 590+ עד אפריל, רק אם רוצים תואר לפני השירות.");
  }
  if (wantsCombat(a) && medical >= 82) {
    push(nextOf([10, 1], thisMonth, draft), "יום סיירות", "פרופיל 82, דפ״ר 50; התוצאה קובעת לאיזה גיבוש תוזמנו.");
    push(nextOf([11, 3], thisMonth, draft), "גיבוש אחוד (מטכ״ל, שלדג)", "5 ימים; מי שסיים ולא התקבל עובר לדראפט 669 וקומנדו.");
    push(nextOf([4, 8, 12], thisMonth, draft), "גיבוש צנחנים", "מבחן כניסה: 3 ק״מ מתחת ל-15 דקות.");
  }
  if (a.rolesInterested.includes("air_force") && medical >= 97) {
    push(nextOf([2, 10], thisMonth, draft), "גיבוש טיס", "פרופיל 97, דפ״ר 60; 5 ימים בחצרים.");
  }
  push(dm >= 7 && dm <= 11 ? new Date(dy, 5, 1) : new Date(dm === 12 ? dy : dy - 1, 9, 1), "הודעת שיבוץ", "כחודש וחצי לפני הגיוס. ערעור: בקשה מנומקת למיטב.", true);
  push(new Date(dy, draft.getMonth(), 1), "גיוס", "יום הגיוס שסימנתם.");

  return items
    .sort((x, y) => x.date.getTime() - y.date.getTime())
    .map((item) => ({ ...item, status: statusFor(item.date, today) }));
}

export const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
