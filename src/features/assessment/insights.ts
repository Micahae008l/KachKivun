import type { AssessmentAnswers } from "./types";

/**
 * Personalized insight moments derived from answers already collected.
 * Every number here comes from an official source listed in docs/IDF-FACTS-AND-SITE-GAPS.md.
 */

export type LadderRung = { profile: number; opens: string; current: boolean; reached: boolean };
export type RouteBar = { label: string; gate: number; note: string; open: boolean };
export type CommitmentBar = { label: string; mandatoryMonths: number; kevaMonths: number };

export type Insight =
  | { id: "combat-trap"; title: string; body: string; routes: RouteBar[] }
  | { id: "profile-ladder"; title: string; body: string; rungs: LadderRung[] }
  | { id: "women-combat"; title: string; body: string; months: { label: string; value: number }[] }
  | { id: "intel-dapar"; title: string; body: string }
  | { id: "tech-commitments"; title: string; body: string; bars: CommitmentBar[] };

const TECH_INTERESTS = new Set(["cyber", "intelligence", "technology_engineering"]);

function numeric(value: number | "unknown" | null): number | null {
  return typeof value === "number" ? value : null;
}

function wantsTech(a: AssessmentAnswers): boolean {
  return (
    a.combatPreference === "TechTrack" ||
    a.focus === "Tech" ||
    a.rolesInterested.some((r) => TECH_INTERESTS.has(r))
  );
}

function wantsCombat(a: AssessmentAnswers): boolean {
  return (
    a.combatPreference === "FieldCombat" ||
    a.combatPreference === "Mixed" ||
    a.rolesInterested.includes("combat")
  );
}

/** Official ladder: mitgaisim "הפרופיל הרפואי" (2022) plus profile 70 (Sept 2026). */
export function profileLadder(profile: number): LadderRung[] {
  return [
    { profile: 97, opens: "הכול, כולל סיירות, 669, טיס" },
    { profile: 82, opens: "חי״ר (גולני, גבעתי, צנחנים, נח״ל, כפיר), הנדסה קרבית, מג״ב, שייטת, מטכ״ל" },
    { profile: 72, opens: "שריון, תותחנים, הגנה אווירית, חילוץ והצלה, חי״ר גבולות, ל״א" },
    { profile: 70, opens: "תותחנים, הגנה אווירית, חיל האוויר (לא חי״ר)" },
    { profile: 64, opens: "תומכי לחימה, לוחם מעברים, מ״כ" },
    { profile: 45, opens: "תפקידי עורף" },
  ].map((rung) => ({ ...rung, current: rung.profile === profile, reached: profile >= rung.profile }));
}

export function deriveInsights(a: AssessmentAnswers): Insight[] {
  const out: Insight[] = [];
  const dapar = numeric(a.daparScore);
  const medical = numeric(a.medicalProfile);
  const male = a.gender === "male";
  const female = a.gender === "female";

  if (male && medical != null && medical >= 82 && wantsTech(a)) {
    const routes: RouteBar[] = [
      { label: "אשכול מקצועות המחשב (ממר״ם, סייבר, DevOps)", gate: 80, note: "לבעלי פרופיל קרבי: דפ״ר 80 + 10 יח״ל טכנולוגיות", open: dapar != null && dapar >= 80 },
      { label: "שחקים (8200 ועוד)", gate: 80, note: "דפ״ר 80-90, מזמנים לפי סף", open: dapar != null && dapar >= 80 },
      { label: "גאמ״א סייבר", gate: 60, note: "דפ״ר 60, 5 יח״ל מדעי המחשב או פנייה למיטב", open: dapar != null && dapar >= 60 },
      { label: "עתודה אקדמית", gate: 60, note: "פסיכומטרי 590+, הרשמה עד 28.2", open: dapar != null && dapar >= 60 },
      { label: "חיל האוויר (טכני, בקרה)", gate: 50, note: "ייעודי ומיוני חיל האוויר", open: dapar != null && dapar >= 50 },
      { label: "שאלון העדפות בלבד", gate: 0, note: "לא יציג תפקידי עורף לבעל פרופיל קרבי", open: false },
    ];
    out.push({
      id: "combat-trap",
      title: `פרופיל ${medical} אצל בנים אומר ייעוד ללוחמה`,
      body:
        `שאלון ההעדפות שתקבל הוא גרסת יחידות השדה, ותפקידי עורף לא יופיעו בו. הדרך לטכנולוגיה עוברת דרך מיונים שמקבלים פרופיל קרבי. ` +
        (dapar == null
          ? "הדפ״ר שלך לא ידוע, אז עדיין לא ברור אילו מסלולים פתוחים."
          : dapar >= 80
            ? `עם דפ״ר ${dapar} אתה עומד על הרף של מיוני אשכול מקצועות המחשב, אבל צריך גם 10 יח״ל טכנולוגיות.`
            : `עם דפ״ר ${dapar} מיוני אשכול מקצועות המחשב סגורים לבעלי פרופיל קרבי (דורשים 80). גאמ״א ועתודה פתוחים מ-60.`) +
        " מאז יוני 2024 צה״ל צמצם משמעותית את מכסות בעלי הפרופיל הקרבי ב-8200 ובתקשוב.",
      routes,
    });
  }

  if (medical != null && medical <= 72 && medical >= 64 && wantsCombat(a)) {
    const body =
      medical === 72
        ? "פרופיל 72 לא מאפשר חי״ר וסיירות (גולני, גבעתי, נח״ל, צנחנים, כפיר, קומנדו). כן פתוחים: שריון, תותחנים, הגנה אווירית, חילוץ והצלה, חי״ר גבולות ומג״ב עם סעיף מתיר."
        : medical === 70
          ? "פרופיל 70 (חדש מספטמבר 2026) פותח תותחנים, הגנה אווירית וחיל האוויר, אבל לא חי״ר ולא שריון."
          : "פרופיל 64 פותח תומכי לחימה ולוחם מעברים. חילוץ והצלה והגנה אווירית דורשים 72.";
    out.push({ id: "profile-ladder", title: `מה פרופיל ${medical} פותח בלחימה`, body, rungs: profileLadder(medical) });
  }

  if (female && wantsCombat(a)) {
    out.push({
      id: "women-combat",
      title: "לוחמה לנשים היא בחירה, עם מחיר של 8 חודשים",
      body:
        "תדרגי אשכול לוחמה בשאלון, תעברי מיון לוחמות (BMI, שיחות וראיונות, בלי מבחן פיזי) ותתחייבי ל-32 חודשים ומילואים. פתוחים: חי״ר גבולות (קרקל, ברדלס, אריות הירדן, לביא הבקעה, פנתר), טנקים בגבולות, תותחנים, הגנה אווירית, חילוץ והצלה, איסוף קרבי, מג״ב, ל״א. סגורים: חטיבות החי״ר המתמרנות והקומנדו. פלוגת טנקים מתמרנת ראשונה לנשים נפתחת בנובמבר 2026.",
      months: [
        { label: "שירות רגיל", value: 24 },
        { label: "לוחמה (דין אישה כדין גבר)", value: 32 },
      ],
    });
  }

  if (dapar != null && dapar < 60 && a.rolesInterested.some((r) => r === "cyber" || r === "intelligence")) {
    out.push({
      id: "intel-dapar",
      title: `דפ״ר ${dapar} ומודיעין: מה כן פתוח`,
      body:
        "יום המיון לכלל חמ״ן מזמין בדרך כלל דפ״ר 60 עד 70. עם דפ״ר 50 פתוחים מסלולי השפות (ערבית, פרסית, מסלול אופק ללא רקע), מסלול אניגמה ומסלול גוונים. " +
        (dapar <= 70 ? "מבחן דפ״ר חוזר אפשרי למי שיש לו 70 ומטה, דרך מיטב." : "") +
        (male && medical != null && medical >= 72 ? " שים לב: כלל חמ״ן אינו מזמין בנים המיועדים ללוחמה." : ""),
    });
  }

  if (dapar != null && dapar >= 70 && wantsTech(a)) {
    out.push({
      id: "tech-commitments",
      title: `דפ״ר ${dapar} עומד בסף של מסלולי הטכנולוגיה, וזה המחיר`,
      body:
        "תוכניתן, מגן סייבר, DevOps ולה״ב מצו״ב דורשים דפ״ר 70 במיוני אשכול מקצועות המחשב. כולם כוללים התחייבות: 32 חודשי חובה (גם לנשים) ועוד קבע. מסלולי 8200 כמו גאמ״א ואמנון דורשים 3 שנות קבע.",
      bars: [
        { label: "תוכניתן/ית", mandatoryMonths: 32, kevaMonths: 30 },
        { label: "מגן/ת סייבר", mandatoryMonths: 32, kevaMonths: 24 },
        { label: "DevOps", mandatoryMonths: 32, kevaMonths: 12 },
        { label: "גאמ״א / אמנון", mandatoryMonths: 32, kevaMonths: 36 },
        { label: "תלפיות", mandatoryMonths: 40, kevaMonths: 72 },
      ],
    });
  }

  return out.slice(0, 3);
}

export type RoadmapItem = { when: string; title: string; detail: string };

/** Dated windows from today to the draft, from official pages. Returns [] when the date is unusable. */
export function draftRoadmap(draftDate: string, a: AssessmentAnswers, today = new Date()): RoadmapItem[] {
  const draft = new Date(draftDate);
  if (Number.isNaN(draft.getTime()) || draft <= today) return [];
  const month = draft.getMonth() + 1; // 1-12
  const firstHalf = month >= 7 && month <= 11; // חציון א: Jul-Nov draft
  const items: RoadmapItem[] = [
    { when: "ספטמבר של כיתה י״ב", title: "שאלון העדפות נפתח", detail: "דרגו עד 3 יעדים גבוה; תפקידי איתור דורשים מיון, תפקידי קביעה לא." },
  ];
  if (wantsTech(a) || a.rolesInterested.includes("intelligence")) {
    items.push(
      { when: firstHalf ? "יוני עד אוקטובר" : "פברואר עד אפריל", title: "גל מיוני כלל חמ״ן", detail: "לא הוזמנתם? פנייה למיטב 1111 (שלוחה 1 ואז 2)." },
      { when: "כפעמיים בשנה (ינואר, יולי בערך)", title: "מיוני אשכול מקצועות המחשב", detail: "יום מקוון ויום פרונטלי; תוצאות תוך 3 עד 6 שבועות." },
    );
  }
  if (wantsCombat(a)) {
    items.push(
      { when: "אוקטובר וינואר", title: "יום סיירות", detail: "פרופיל 82 ודפ״ר 50; התוצאה קובעת גיבוש מטכ״ל/שלדג, שייטת או חובלים." },
      { when: "נובמבר ומרץ", title: "גיבוש אחוד (מטכ״ל, שלדג)", detail: "5 ימים; מי שסיים ולא התקבל עובר לדראפט 669 וקומנדו." },
      { when: "אפריל, אוגוסט, דצמבר", title: "גיבוש צנחנים", detail: "מבחן כניסה: 3 ק״מ מתחת ל-15 דקות." },
    );
  }
  if (a.rolesInterested.includes("air_force")) {
    items.push({ when: "פברואר/מרץ ואוקטובר/נובמבר", title: "גיבוש טיס", detail: "פרופיל 97, דפ״ר 60; 5 ימים בחצרים." });
  }
  items.push(
    { when: "עד 28 בפברואר", title: "סגירת שאלון העתודה האקדמית", detail: "פסיכומטרי 590+ עד אפריל; רלוונטי רק אם רוצים תואר לפני השירות." },
    { when: firstHalf ? "עד יוני" : "עד אוקטובר", title: "הודעת שיבוץ", detail: "SMS כחודש וחצי לפני הגיוס. ערעור: בקשה מנומקת למיטב." },
  );
  return items;
}
