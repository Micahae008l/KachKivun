/** Shared Hebrew aria copy and helpers for RTL screen readers. */

export const MAIN_CONTENT_ID = "main-content";
export const MOBILE_NAV_ID = "mobile-nav";

export const ARIA = {
  main: "תוכן ראשי",
  skipToMain: "דלג לתוכן הראשי",
  navPrimary: "ניווט ראשי",
  navMobile: "תפריט ניווט נייד",
  siteHeader: "כותרת עליונה",
  footer: "כותרת תחתונה",
  openMenu: "פתח תפריט",
  closeMenu: "סגור תפריט",
  a11yMenu: "תפריט נגישות",
  openA11yMenu: "פתח תפריט נגישות",
  closeA11yMenu: "סגור תפריט נגישות",
  heroSlideshow: "מצגת תמונות ראשית",
  heroSlide: (index: number, total: number) => `עבור לשקופית ${index} מתוך ${total}`,
  heroSlideCurrent: (index: number, total: number) => `שקופית ${index} מתוך ${total}, נוכחית`,
  heroPrev: "שקופית קודמת",
  heroNext: "שקופית הבאה",
  heroPause: "השהה מצגת",
  heroPlay: "המשך מצגת",
  heroSlideStatus: (index: number, total: number) => `שקופית ${index} מתוך ${total}`,
  chatLog: "הודעות התאמת תפקידים",
  chatLoading: "מחשב התאמה",
  roleResults: "תוצאות התאמת תפקידים",
  expandRole: (title: string, expanded: boolean) =>
    expanded ? `הסתר פירוט עבור ${title}` : `הצג פירוט עבור ${title}`,
  matchPct: (pct: number) => `${pct} אחוז התאמה`,
  progressPct: (pct: number, label: string) => `${label}: ${pct} אחוז`,
  toggleOption: (label: string, selected: boolean) =>
    `${label}, ${selected ? "נבחר" : "לא נבחר"}`,
  scoreChip: (score: number, selected: boolean) =>
    `ציון ${score}, ${selected ? "נבחר" : "לא נבחר"}`,
  rangeValue: (title: string, value: number, max: number) => `${title}: ${value} מתוך ${max}`,
  accountPreferences: "העדפות חשבון",
  matchHistory: "היסטוריית התאמות",
  deleteMatch: (title: string) => `מחק התאמה: ${title}`,
} as const;

export function progressBarProps(pct: number, label: string) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  return {
    role: "progressbar" as const,
    "aria-valuenow": clamped,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-label": label,
    "aria-valuetext": ARIA.progressPct(clamped, label),
  };
}
