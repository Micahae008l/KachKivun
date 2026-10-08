import { YOM_HAMEAH_KEYS, YOM_HAMEAH_LABELS_HE, type YomHameahKey } from "@/lib/yom-hameah";
import { deriveAssessmentBranches } from "./flow";
import { ROLE_AVOIDANCE_OPTIONS } from "./options";
import type { AssessmentAnswers, AssessmentStepId } from "./types";

/**
 * Everything the checkpoint and review screens visualize, derived only from the user's answers.
 * Thresholds come from official mitgaisim.idf.il pages; see docs/IDF-FACTS-AND-SITE-GAPS.md.
 */

const TECH_INTERESTS = new Set(["cyber", "intelligence", "technology_engineering"]);

const num = (v: number | "unknown" | null): number | null => (typeof v === "number" ? v : null);

export function wantsTech(a: AssessmentAnswers): boolean {
  return (
    a.combatPreference === "TechTrack" ||
    a.focus === "Tech" ||
    a.focus === "Research" ||
    a.focusExtra.includes("Tech") ||
    a.rolesInterested.some((r) => TECH_INTERESTS.has(r))
  );
}

export function wantsCombat(a: AssessmentAnswers): boolean {
  return (
    a.combatPreference === "FieldCombat" ||
    a.combatPreference === "Mixed" ||
    a.rolesInterested.includes("combat")
  );
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

  if (combat && medical >= 82 && (!female || medical >= 97))
    add(50, "יום סיירות (מטכ״ל, שלדג, שייטת)");
  if (intel) add(50, "מסלולי שפות: ערבית, פרסית, אופק");
  if (tech || intel) add(60, "גאמ״א סייבר");
  if (intel && !combatMale) add(60, "יום מיון כלל חמ״ן");
  if (tech && !combatMale) add(60, "אשכול מקצועות המחשב: QA, דאטה, מיישם הגנה");
  if ((air || combat) && medical >= 97) add(60, "קורס טיס");
  if (combat && medical >= 82 && (a.rolesInterested.includes("navy") || air))
    add(60, "חובלים, צוללות");
  if (tech && !combatMale) add(70, "תוכניתן, מגן סייבר, DevOps, לה״ב");
  if (tech || a.focus === "Research") add(70, "עתודה עילית: פסגות, אלונים, ברקים");
  if (tech && combatMale) add(80, "אשכול מקצועות המחשב לבעלי פרופיל קרבי (+10 יח״ל)");
  if (tech || intel) add(80, "שחקים: אמנון, אח״מ, אע״מ (8200)");
  if (tech || a.focus === "Research") add(90, "תלפיות");

  return [...doors.entries()]
    .sort((x, y) => y[0] - x[0])
    .map(([dapar, items]) => ({ dapar, items }));
}

// ---------- profile ladder ----------

export type ProfileRung = { profile: number; opens: string };

export const PROFILE_RUNGS: ProfileRung[] = [
  { profile: 97, opens: "הכול, כולל 669 וטיס" },
  { profile: 82, opens: "חי״ר, סיירות, הנדסה קרבית, מג״ב, שייטת, מטכ״ל" },
  { profile: 72, opens: "שריון, תותחנים, הגנה אווירית, חילוץ, חי״ר גבולות" },
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

export type DimensionRow = {
  key: YomHameahKey;
  label: string;
  score: number;
  opens: string;
  top: boolean;
};

export function dimensionRows(a: AssessmentAnswers): { rows: DimensionRow[]; flat: boolean } {
  const rows = YOM_HAMEAH_KEYS.map((key) => ({
    key,
    label: YOM_HAMEAH_LABELS_HE[key],
    score: a.yomHameah[key],
    opens: DIMENSION_OPENS[key],
    top: false,
  })).sort((x, y) => y.score - x.score);
  const flat = rows.every((r) => r.score === rows[0].score);
  if (!flat)
    rows
      .filter((r) => r.score === rows[0].score && r.score >= 4)
      .slice(0, 3)
      .forEach((r) => (r.top = true));
  return { rows, flat };
}

// ---------- commitment timeline ----------

export type CommitmentRow = {
  label: string;
  mandatory: number;
  keva: number;
  release: Date;
  end: Date;
};

const addMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() + m, 1);

export function commitmentRows(a: AssessmentAnswers): CommitmentRow[] {
  const draft = new Date(a.draftDate);
  if (Number.isNaN(draft.getTime())) return [];
  const female = a.gender === "female";
  const rows: [string, number, number][] = [];
  if (wantsTech(a)) {
    rows.push(
      ["תוכניתן/ית", 32, 30],
      ["מגן/ת סייבר", 32, 24],
      ["DevOps", 32, 12],
      ["גאמ״א / אמנון", 32, 36],
    );
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

export const formatMonth = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function monthsUntil(date: Date, today = new Date()): number {
  return (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
}

// ---------- next steps (review step) ----------

/** Up to four concrete things to do now, from the answers. No dates: those come from מיטב. */
export function nextSteps(a: AssessmentAnswers): string[] {
  const steps: string[] = [];
  if (a.daparScore === "unknown" || a.medicalProfile === "unknown") {
    steps.push("בדקו את הדפ״ר והפרופיל הרפואי באזור האישי באתר מתגייסים. בלעדיהם אי אפשר לאמת זכאות לתפקידים.");
  }
  if (a.yomHameahSource !== "official") {
    steps.push("אחרי יום המא״ה התוצאות מופיעות באזור האישי. עדכנו כאן את הציונים הרשמיים, וההתאמות יתעדכנו.");
  }
  if (wantsTech(a)) {
    steps.push("מיוני הטכנולוגיה, כמו אשכול מקצועות המחשב, נפתחים כפעמיים בשנה. עקבו אחרי ההודעות כדי לא לפספס חלון.");
  }
  if (wantsCombat(a)) {
    steps.push("גיבושים בודקים ריצה, מתח ושכיבות סמיכה. אימון קבוע מהיום עושה את ההבדל.");
  }
  steps.push("כשנפתח שאלון ההעדפות, דרגו בו את התפקידים שמעניינים אתכם. הוא חלק מרכזי בשיבוץ.");
  steps.push("חזרו לעדכן כאן אחרי כל שלב בתהליך: כל נתון חדש מדייק את ההתאמות.");
  return steps.slice(0, 4);
}

// ---------- live reflection under each step ----------

const FOCUS_LABEL: Record<string, string> = {
  Tech: "מיקוד טכנולוגי",
  Physical: "אתגר פיזי",
  Research: "מחקר ואנליזה",
  Medical: "רפואה וטיפול",
};
const FITNESS_LABEL: Record<string, string> = { Low: "בסיסית", Medium: "בינונית", High: "גבוהה" };
const READINESS_LINE: Record<string, string> = {
  ready: "מוכנות פיזית טובה. המסלולים התובעניים נשארים על השולחן.",
  needs_improvement: "כושר אפשר לשפר עד הגיוס. נראה גם מסלולים שמתאימים לרמה של היום.",
  wants_to_improve: "כושר אפשר לשפר עד הגיוס. נראה גם מסלולים שמתאימים לרמה של היום.",
  unsure: "נשלב מסלולים בכמה רמות קושי, ותראו מה מתאים.",
};
const MOTIVATION_LINE: Record<string, string> = {
  contribution: "תרומה למדינה: נבליט תפקידים שבהם ההשפעה שלכם מורגשת.",
  challenge: "מחפשים אתגר: נעדיף מסלולים עם מיונים וקורסים תובעניים.",
  career: "מקצוע להמשך: נעדיף תפקידים עם הכשרה שנחשבת גם אחרי השחרור.",
  friends_experience: "חוויה וחברים: נעדיף תפקידים עם צוות מגובש.",
  personal_growth: "לגדול ולהתפתח: נעדיף תפקידים שבהם האחריות גדלה לאורך השירות.",
  unsure: "זה בסדר לא לדעת עדיין. שאר התשובות מספיקות כדי לדייק.",
};

/** One short, honest line reacting to what was just answered, or null if nothing to say yet. */
export function stepReflection(step: AssessmentStepId, a: AssessmentAnswers): string | null {
  const branches = deriveAssessmentBranches(a);
  switch (step) {
    case "roles": {
      if (!a.rolesInterested.length) return null;
      const count = a.rolesInterested.length;
      const parts = [
        a.rolesInterested.includes("undecided")
          ? "עדיין לא יודעים? בדיוק בשביל זה אנחנו כאן."
          : count === 1
            ? "תחום אחד נבחר."
            : `${count} תחומים נבחרו.`,
      ];
      if (branches.wantsTechnical && a.combatPreference !== "TechTrack") {
        parts.push("נוסיף שלב קצר על ניסיון טכנולוגי.");
      }
      if (
        branches.wantsCombat &&
        a.combatPreference !== "FieldCombat" &&
        a.combatPreference !== "Mixed"
      ) {
        parts.push("נוסיף כמה שאלות כושר.");
      }
      if (a.rolesAvoided.length) {
        const avoided = ROLE_AVOIDANCE_OPTIONS.filter((o) => a.rolesAvoided.includes(o.value)).map(
          (o) => o.label,
        );
        parts.push(`ניקח בחשבון שתעדיפו להימנע מ: ${avoided.join(", ")}.`);
      }
      return parts.join(" ");
    }
    case "preferences": {
      if (!a.focus || !a.physicalActivityLevel) return null;
      const tail =
        a.focus === "Physical" && a.physicalActivityLevel === "Low"
          ? "שילוב מעניין: נחפש תפקידי שטח שלא דורשים כושר קרבי."
          : a.physicalActivityLevel === "High"
            ? "כושר גבוה פותח גם מסלולים פיזיים תובעניים."
            : a.physicalActivityLevel === "Low"
              ? "נעדיף תפקידים שבהם הראש עובד יותר מהרגליים."
              : "כאן נמצאים רוב המתגייסים, ויש הרבה מאיפה לבחור.";
      const focuses = [a.focus, ...a.focusExtra].map((f) => FOCUS_LABEL[f]).join(" + ");
      return `${focuses} עם רמת פעילות ${FITNESS_LABEL[a.physicalActivityLevel]}. ${tail}`;
    }
    case "environment": {
      if (!a.basePreference) return null;
      const base =
        a.basePreference === "open"
          ? "בסיס פתוח: נעדיף תפקידים עם יומיות"
          : a.basePreference === "closed"
            ? "בסיס סגור פותח את רוב התפקידים המבצעיים והקרביים"
            : "גמישות בבסיס מרחיבה מאוד את מספר התפקידים שנבדוק";
      const env =
        a.environment === "field"
          ? ", עם עבודה בחוץ"
          : a.environment === "office"
            ? ", מול מסך"
            : a.environment === "mixed"
              ? ", בשילוב של שטח ומשרד"
              : "";
      return `${base}${env}.`;
    }
    case "style": {
      if (!a.leadership) return null;
      const lead =
        a.leadership === "want_lead"
          ? "רוצים לפקד: נשים לב לתפקידים עם המשך לקורס מפקדים וקצונה"
          : a.leadership === "open"
            ? "פתוחים לפיקוד אם יציעו: נשאיר את הדלת הזו פתוחה"
            : "חלק מצוות: נעדיף תפקידים שבהם הכוח הוא בעבודה המשותפת";
      const stress =
        a.stress === "high"
          ? ", ותפקוד טוב בלחץ מתאים לתפקידים מבצעיים."
          : a.stress === "low"
            ? ", בסביבה רגועה יחסית."
            : ".";
      return lead + stress;
    }
    case "combat":
      return READINESS_LINE[a.combatDetails.readiness] ?? null;
    case "technical": {
      const level = a.technicalDetails.level;
      if (!level) return null;
      if (level === "advanced" || level === "expert") {
        return "ניסיון גבוה: מסלולים כמו תוכניתן ומגן סייבר רלוונטיים במיוחד, בכפוף לדפ״ר.";
      }
      if (level === "intermediate")
        return "בסיס טוב. הרבה מסלולי טכנולוגיה בצה״ל מלמדים מאפס בקורס.";
      return "לא צריך ניסיון קודם: רוב קורסי הטכנולוגיה בצה״ל מתחילים מההתחלה.";
    }
    case "scores": {
      const parts: string[] = [];
      const dapar = num(a.daparScore);
      const medical = num(a.medicalProfile);
      if (dapar != null) {
        const doors = daparDoors(a);
        const total = doors.reduce((n, d) => n + d.items.length, 0);
        const open = doors.filter((d) => d.dapar <= dapar).reduce((n, d) => n + d.items.length, 0);
        if (total) {
          parts.push(
            open === total
              ? `דפ״ר ${dapar}: כל ${total} מסלולי המיון שקשורים לבחירות שלכם פתוחים.`
              : `דפ״ר ${dapar}: ${open} מתוך ${total} מסלולי המיון שקשורים לבחירות שלכם פתוחים.`,
          );
        }
      }
      if (medical != null) {
        const rung = PROFILE_RUNGS.find((r) => medical >= r.profile);
        if (rung) parts.push(`פרופיל ${medical} פותח: ${rung.opens}.`);
      }
      if (!parts.length && (a.daparScore === "unknown" || a.medicalProfile === "unknown")) {
        return "אין בעיה. נתאים לפי שאר התשובות, ותוכלו לעדכן כשתקבלו את הנתונים.";
      }
      return parts.length ? parts.join(" ") : null;
    }
    case "yom": {
      if (a.yomHameahSource === "unknown") {
        return "בסדר גמור. ההתאמה תתבסס על שאר התשובות שלכם.";
      }
      if (!a.yomHameahSource) return null;
      const { rows, flat } = dimensionRows(a);
      if (flat) return "כל הציונים שווים כרגע. הזיזו את החזקים שלכם למעלה כדי שנראה מה בולט.";
      const top = rows.filter((r) => r.top);
      if (!top.length) return null;
      return `החוזקות הבולטות שלכם: ${top.map((r) => r.label).join(", ")}. הן פותחות בעיקר: ${top[0].opens}.`;
    }
    case "motivation": {
      const line = a.motivations[0] ? (MOTIVATION_LINE[a.motivations[0]] ?? null) : null;
      return line && a.extraNote.trim() ? `${line} והיועץ יענה על הבקשה שלכם בראש התוצאות.` : line;
    }
    case "identity": {
      const name = a.preferredName.trim();
      return name ? `נעים להכיר, ${name}. עוד רגע הפרופיל מוכן.` : null;
    }
    default:
      return null;
  }
}
