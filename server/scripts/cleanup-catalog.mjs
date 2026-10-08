/**
 * One-off catalog cleanup (2026-10-08), from docs/IDF-FACTS-AND-SITE-GAPS.md sections 4-5:
 *  - remove roles that do not exist on mitgaisim.idf.il as draftee roles
 *  - fix wrong categories/tags on kept roles
 *  - add the missing אמ"ן / תקשוב / עתודה / IAF / Navy / combat tracks, with official thresholds
 * Idempotent: safe to re-run.
 *   node scripts/cleanup-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "../data/idf-roles-preference-catalog.json");
const enrichPath = path.join(__dirname, "../data/role-enrichment-v3.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const enrich = JSON.parse(fs.readFileSync(enrichPath, "utf8"));
const M = "mitgaisim.idf.il";

// ---------- 1. remove ----------
const REMOVE = [
  // cyber / תקשוב names that are not mitgaisim roles
  "מנטר/ת אירועי סייבר", 'מפעיל צופן פענוח רשת (צפ"ר)', 'מש"ק מט"ל (מש"ק טכנולוגי)', "אבנט כחול", "מפעיל/ת תקשורת נתונים",
  "מנהל/ת מערכות Linux", "מנהל/ת מערכות Windows", "תומך/ת Help Desk צבאי", "חוקר/ת פורנזיקה דיגיטלית",
  "מפעיל מרכז שליטה מבצעית – חטיבת הסייבר-סיגינט", "נתמ״מ", "מטמיע/ת מערכות מידע",
  // intelligence names that are functions inside real tracks, or screenings
  "אנליסט/ית סיגינט", "חוקר/ת מודיעין ממקורות גלויים", "חוקר/ת רשתות חברתיות מודיעיני/ת", "מפענח/ת תצלומי אוויר",
  "רכז/ת מודיעין", "חוקר/ת מודיעין מטרות", "מפענח/ת תת קרקע", "ממפה/ת מבצעי/ת", "חוקר/ת מודיעין גאוגרפי", 'יום מיון למסלולי כלל חמ"ן',
  // IAF / Navy: no page, not draft-entry, or duplicates
  'מש"ק/ית תיאום אווירי', "רכז/ת מבצעים בחיל האוויר", "חובש/ת תעופתי/ת", "חובש/ת ימי/ת", "מכשירנית ימית", "טכנאי/ת מערכות ימיות",
  "מכונאי/ת מוטס/ת", "מפעיל/ת כטמ״ם", "אלחוטן/ית ימי/ת",
  // unconfirmed for 2026
  "עתודה לפסיכולוגיה",
];

// ---------- 2. fix kept roles ----------
const FIX = {
  "מסלול גאמ״א": { category: "מודיעין / סייבר", preferenceTags: ["cyber", "coding", "software", "research", "intelligence"] },
  "מרום טכנולוגי": { category: "מסלולי הנדסאים / טכנולוגי" },
  "תכנית סיגמא": { category: "מסלולי הנדסאים / אלקטרוניקה" },
  "מגן/ת סייבר": { preferenceTags: ["cyber", "coding", "networks", "research"] },
  'מפעיל/ת לוחמה אלקטרונית (ל"א)': { category: "אוויר / לוחמה אלקטרונית", preferenceTags: ["electronics", "operations", "intelligence", "attention-to-detail"] },
  "לוחם לוחמה אלקטרונית": { category: "אוויר / לוחמה אלקטרונית", preferenceTags: ["electronics", "operations", "combat", "fieldwork"] },
  'מפעיל/ת מודיעין אלקטרוני (מודא"ל) מוטס': { preferenceTags: ["intelligence", "research", "aviation", "electronics"] },
  "אלחוטנית חוף": { roleTitle: 'אחראי/ת תקשורת ימית מסווגת (אתי"ם)', category: "חיל הים / תקשורת", preferenceTags: ["networks", "sea", "attention-to-detail", "operations"] },
};

// ---------- 3. add ----------
// [title, category, combat, tags, signalsHe[], bestFor, sourcePath, enrichment{d,m,g,tier,comp,len,req}]
const ADD = [
  // אמ"ן
  ['מסלול אח"מ פיתוח', "מודיעין עילית / שחקים", false, ["coding", "software", "cyber", "intelligence"], ["פיתוח תוכנה ביחידות הסייבר של אמ\"ן", "5 יח\"ל מחשבים", "קבע 3 שנים"], "software developers with CS background for אמ\"ן cyber units", "/roles/מסלול-אחמ-פיתוח/", { d: 60, m: 21, g: "all", tier: "elite", comp: "very_high", len: "כ-6 חודשי הכשרה; 32 חודשים (גם לנשים) + 3 שנות קבע", req: ['דפ"ר 60', '5 יח"ל מדעי המחשב או תואר', 'טר"צ כ-12 שבועות'] }],
  ['מסלול מט"מ', "מודיעין / איסוף", false, ["intelligence", "data", "attention-to-detail", "operations"], ["הפעלת מערכות איסוף", "עיבוד מידע מודיעיני", "משמרות"], "SIGINT collection and processing in a central אמ\"ן unit", "/roles/מסלול-מטמ/", { d: 60, m: 21, g: "all", tier: "standard", comp: "high", len: "כ-4 חודשי הכשרה במרכז; נשים 32 חודשים", req: ['דפ"ר 60 ומעלה', "פרופיל 25 ומעלה", "מגמה ריאלית"] }],
  ["מסלול בכיר לדוברי השפה הפרסית", "מודיעין / שפות", false, ["languages", "intelligence", "research", "attention-to-detail"], ["פרסית ברמת שפת אם", "האזנה ותרגום", "זירת איראן"], "native Persian speakers for intelligence collection", "/תפקידים/מסלול-בכיר-לדוברי-השפה-הפרסית/", { d: 50, m: 21, g: "all", tier: "standard", comp: "medium", len: "4-5 חודשי הכשרה; עבודה במשמרות; נשים 32 חודשים", req: ["פרסית מהבית", 'דפ"ר 50 ומעלה', "פרופיל 25 ומעלה"] }],
  ["מסלולי ערבית (אלמוג, רשף, קדם)", "מודיעין / שפות", false, ["arabic", "languages", "intelligence", "attention-to-detail"], ["5 יח\"ל ערבית", "האזנה, תרגום ועיבוד", "בסיסים סגורים"], "students with 5 units of Arabic for the אמ\"ן operational core", "/תפקידים/מסלולי-ערבית/", { d: 50, m: 21, g: "all", tier: "standard", comp: "medium", len: "כ-5 חודשים אחרי רובאי 02; בסיסים סגורים 11/3", req: ['5 יח"ל ערבית', 'דפ"ר 50 ומעלה', "עברית 7", "פרופיל 25 ומעלה"] }],
  ['מסלול ממ"ש', "מודיעין / טכנולוגי", false, ["it", "devops", "operations", "intelligence"], ["תפעול ופרויקטים ביחידת סייבר מובילה", "טר\"צ בדרום", "קבע שנה"], "ops/projects in a leading אמ\"ן cyber unit", "/roles/מסלול-ממש/", { d: 60, m: 21, g: "all", tier: "standard", comp: "high", len: "טר\"צ + קורס צבאי; שנת קבע; נשים כמו גברים", req: ['דפ"ר 60 ומעלה', "פרופיל 25 ומעלה", "מגמה ריאלית"] }],
  ["מסלול אניגמה מחשבים", "מודיעין / טכנולוגי", false, ["software", "it", "qa", "coding"], ["ידע נרחב במחשבים", "פיתוח, IT ובדיקות", "חניכה ביחידה"], "self-taught computer people without formal CS for אמ\"ן tech units", "/roles/מסלול-אניגמה-מחשבים/", { d: 50, m: 21, g: "all", tier: "standard", comp: "medium", len: "חניכה ביחידה; שנת קבע", req: ['דפ"ר 50 ומעלה', "ידע נרחב במחשבים"] }],
  ["מסלול רומא", "מודיעין / טכנולוגי", false, ["hardware", "physics", "coding", "operations"], ["טכנולוגיות תלת-ממד לכוחות מיוחדים", "פרופיל 72", "שעות ארוכות"], "3D/tech support for special forces inside אמ\"ן", "/roles/מסלול-רומא/", { d: 70, m: 72, g: "all", tier: "standard", comp: "very_high", len: "טירונות 03 + קורס יחידתי; 4 חודשי קבע; נשים 16א", req: ["פרופיל 72 ומעלה", 'דפ"ר 70 ומעלה', "מחשבים / פיזיקה / רובוטיקה"] }],
  ["מסלול נץ", "מודיעין / מבצעים", false, ["intelligence", "operations", "visual-analysis", "attention-to-detail"], ["תפקיד מבצעי ב-9900", "3 חודשי הכשרה", "ללא יציאה יומית"], "operational visual-intelligence role", "/roles/מסלול-נץ/", { d: null, m: 21, g: "all", tier: "standard", comp: "medium", len: "3 חודשי הכשרה; נשים 30 חודשים", req: ["פרופיל 25 ומעלה"] }],
  ['חוקר/ת מודיעין טכנולוגי (מסלול חומה)', "מודיעין / מחקר", false, ["intelligence", "research", "cyber", "electronics"], ["מחקר סייבר וספקטרום", "20 שבועות הכשרה", "בסיסים פתוחים במרכז"], "cyber/spectrum intelligence analysts", "/roles/חוקר-מודיעין-טכנולוגי/", { d: null, m: 21, g: "all", tier: "standard", comp: "medium", len: "טירונות 02 + כ-20 שבועות; נשים 32 חודשים", req: ["מגמה ריאלית יתרון"] }],
  ["אנליסט/ית ביטחוני/ת", "מודיעין / מחקר", false, ["research", "data", "attention-to-detail", "law"], ["עבודה מול גורמי הסיווג של שב\"כ", "4 חודשים בבה\"ד 15"], "security vetting analysts", "/roles/אנליסט-בטחוני/", { d: 60, m: 21, g: "all", tier: "standard", comp: "medium", len: "כ-4 חודשים בבה\"ד 15", req: ['דפ"ר 60', "עברית 8"] }],
  ['מש"ק/ית מערך (מודיעין שדה)', "מודיעין / שדה", false, ["intelligence", "fieldwork", "operations", "maps"], ["יד ימינו של קצין המודיעין בגדוד", "בה\"ד 15", "ללא מיון"], "field intelligence NCOs attached to combat battalions", "/roles/משקית-מערך-בחיל-המודיעין/", { d: 60, m: 64, g: "all", tier: "standard", comp: "low", len: "טירונות 02 + חודשיים בבה\"ד 15", req: ["פרופיל 64 ומעלה", 'דפ"ר 60', "עברית 7", "לא נדרש מיון"] }],
  ["לוחם אתגרים", "לחימה / איסוף", true, ["combat", "intelligence", "electronics", "fieldwork"], ["לוחמי סיגינט שדה", "לחימה + טכנולוגיה", "פרופיל 82"], "field SIGINT fighters (8200)", "/roles/לוחם-אתגרים/", { d: null, m: 82, g: "male_only", tier: "elite", comp: "very_high", len: "32 חודשים", req: ["פרופיל 82 ומעלה", "מגמה ריאלית", "גברים"] }],
  // תקשוב
  ['מט"ס - מפתח/ת טכנולוגיות סייבר (מצו"ב)', "סייבר", false, ["devops", "coding", "cyber", "software"], ["DevOps / DevSecOps / Platform במצו\"ב", "קד\"צ 15 שבועות", "צריפין"], "platform/DevSecOps developers at מצו\"ב", "/roles/מטס-מפתח-טכנולוגיות-סייבר-ביחידת-מצוב/", { d: 70, m: 21, g: "all", tier: "standard", comp: "very_high", len: "32 חודשים; התחייבות קבע צפויה לעבור לתקנה 16א", req: ["מיוני אשכול או מיון ייעודי", 'דפ"ר 70 (80 לפרופיל קרבי)'] }],
  ["מסלול SRE - תקשוב", "מקצועות המחשב", false, ["devops", "it", "networks", "software"], ["אמינות מערכות", "צוותי פיתוח בכל הזרועות"], "site reliability engineering track at בסמ\"ח", "/roles/מסלול-sre-תקשוב/", { d: 60, m: 21, g: "all", tier: "standard", comp: "high", len: "", req: ["מיוני אשכול מקצועות המחשב", 'דפ"ר 60', "לא לבעלי ייעוד קרבי", "עברית 5"] }],
  ["דאטא אנליסט/ית (אנליסט מידע מבצעי)", "דאטה / תוכנה", false, ["data", "math", "coding", "attention-to-detail"], ["SQL, סטטיסטיקה, BI, Python", "קד\"צ 16 שבועות", "בתי תוכנה"], "data analysts for software houses", "/roles/דאטא-אנליסט/", { d: 60, m: 21, g: "all", tier: "standard", comp: "high", len: "32 חודשים (גם לנשים)", req: ["מיוני אשכול מקצועות המחשב", 'דפ"ר 60', "פרופיל עורפי לגברים"], maleMax: 64 }],
  ["מנהל/ת DC", "תקשוב / תשתיות", false, ["it", "networks", "devops"], ["מרכזי נתונים בכל הזרועות", "10 שבועות בבסמ\"ח"], "data-centre administrators", "/roles/מנהלת-dc/", { d: 60, m: 21, g: "all", tier: "standard", comp: "medium", len: "", req: ["מיוני אשכול מקצועות המחשב", 'דפ"ר 60', "פרופיל עורפי לגברים"], maleMax: 64 }],
  ['פס"י - מפתח/ת ספקטרום (פריזמה)', "תקשוב / ספקטרום", false, ["coding", "electronics", "physics", "software"], ["פיתוח ספקטראלי ייעודי", "C++/Python", "14-19 שבועות בבסיס סגור"], "spectrum software developers at פריזמה", "/roles/פסי-פיתוח-ספקטראלי-ייעודי-מפתח-ספקטרום/", { d: 70, m: 21, g: "all", tier: "standard", comp: "very_high", len: "14-19 שבועות הכשרה בבסיס סגור", req: ["מיוני אשכול + מיון ייעודי", 'דפ"ר 70', '10 יח"ל טכנולוגיות לפרופיל קרבי'] }],
  ["טכנאי/ת סיסטם (דיגיטל מבצעי)", "תקשוב", false, ["it", "networks", "fieldwork", "operations"], ["תחזוקת מערכות דיגיטל מבצעיות", "12 שבועות בבה\"ד 7", "ללא מיון"], "operational digital/system technicians", "/roles/טכנאית-סיסטם-טכנאית-דיגיטל-מבצעי/", { d: null, m: 45, g: "all", tier: "standard", comp: "low", len: "", req: ["לא נדרש מיון", "פרופיל 45 ומעלה", "עברית 6", "הפעלה טכנית 3"] }],
  ["מפעיל/ת דיגיטל מבצעי", "תקשוב / מבצעים", false, ["operations", "it", "war-room", "fieldwork"], ["תפעול מערכות דיגיטל באוגדות ובפיקודים", "פרופיל 64"], "operational digital operators in divisions and commands", "/roles/מפעילת-דיגיטל-מבצעי/", { d: null, m: 64, g: "all", tier: "standard", comp: "low", len: "טירונות 02 + כ-6 שבועות", req: ["פרופיל 64 ומעלה", "הפעלה טכנית 3", "לא לבעלי ייעוד קרבי"] }],
  ['מש"ק/ית שליטה בדיגיטל', "תקשוב / שליטה", false, ["it", "networks", "operations", "admin"], ["שליטה במערכות דיגיטל מחטיבה עד מטכ\"ל", "7 שבועות"], "digital control NCOs", "/roles/משק-שליטה-בדיגיטל/", { d: 50, m: 45, g: "all", tier: "standard", comp: "low", len: "", req: ["לא נדרש מיון", 'דפ"ר 50'] }],
  ["בקר/ית רשת (חושן)", "תקשוב / תשתיות", false, ["networks", "operations", "attention-to-detail"], ["בקרת רשתות טלפוניה ותקשורת", "צריפין"], "network controllers in חושן battalions", "/roles/בקרית-רשת/", { d: null, m: 45, g: "all", tier: "standard", comp: "low", len: "טירונות 02 + 5 שבועות, צריפין", req: ["פרופיל 45 ומעלה", "הפעלה טכנית 3", "קשב 3"] }],
  ["רכז/ת שירותי תקשוב", "תקשוב / שירות", false, ["service", "it", "admin"], ["מוקד שירות תקשוב", "CRM", "ללא ידע קודם"], "IT service-desk coordinators", "/roles/רכז-שירותי-תקשוב/", { d: null, m: 45, g: "all", tier: "standard", comp: "low", len: "טירונות 02 + 4 שבועות, צריפין", req: ["פרופיל 45 ומעלה", "ללא ידע קודם"] }],
  ["קצונה ייעודית מבצעית בחיל התקשוב", "קצונה / תקשוב", false, ["leadership", "networks", "operations", "it"], ["מסלול לקצונה מהגיוס", "כ-55 שבועות", "בה\"ד 1"], "officer-from-enlistment track in the signal corps", "/roles/קצונה-ייעודית-מבצעית-בחיל-התקשוב/", { d: null, m: 45, g: "all", tier: "standard", comp: "high", len: "כ-55 שבועות הכשרה כולל בה\"ד 1", req: ["פרופיל 45 ומעלה", "מיון ייעודי מאוחד", "הדרכה 2, פיקוד 2"] }],
  // עתודה / אקדמי
  ["תכנית רעמים", "עתודה / הנדסה", false, ["electronics", "physics", "math", "research"], ["B.Sc.+M.Sc. הנדסת חשמל", "RF, תקשורת, שבבים", "בן-גוריון"], "elite EE academic reserve", "https://www.bgu.ac.il/articles/new-elite-academic-programs-idf/", { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "5 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 650", 'דפ"ר 70'] }],
  ["תכנית סילון", "עתודה / אווירונאוטיקה", false, ["physics", "math", "aviation", "research"], ["B.Sc. אווירונאוטיקה + M.Sc.", "טכניון"], "elite aerospace academic reserve", 'מידעון העתודה תשפ"ז', { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "5 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 650", 'דפ"ר 70'] }],
  ["תכנית גבישים", "עתודה / הנדסה", false, ["physics", "chemistry", "research", "math"], ["B.Sc.+M.Sc. הנדסת חומרים", "טכניון"], "elite materials-engineering academic reserve", 'מידעון העתודה תשפ"ז', { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "5 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 650", 'דפ"ר 70'] }],
  ["תכנית אביבים", "עתודה / הנדסה", false, ["math", "data", "leadership", "research"], ["B.Sc.+M.Sc. הנדסת תעשייה וניהול", "AI וניהול מוצר"], "elite IE&M academic reserve", 'מידעון העתודה תשפ"ז', { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "4.5 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 660", 'דפ"ר 70'] }],
  ["תכנית גלקסיה", "עתודה / מדעים", false, ["physics", "math", "research", "mechanics"], ["B.Sc.+M.Sc. פיזיקה", "בן-גוריון"], "elite physics academic reserve", 'מידעון העתודה תשפ"ז', { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "4 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 675", 'דפ"ר 70'] }],
  ["תכנית ביו", "עתודה / מדעים", false, ["biology", "data", "coding", "research"], ["ביולוגיה חישובית", "האוניברסיטה העברית"], "elite computational-biology academic reserve", 'מידעון העתודה תשפ"ז', { d: 70, m: 21, g: "all", tier: "elite", comp: "very_high", len: "4 שנות לימוד + 32 חודשי חובה כקצין + 3 שנות קבע", req: ["פסיכומטרי 720", 'דפ"ר 70'] }],
  ["מסלול אקדמיזציה", "עתודה / אקדמי", false, ["research", "leadership", "coding", "math"], ["למי שכבר יש תואר", "קמ\"א", "קבע 24 חודשים"], "degree holders enlisting as academic officers", "/כתבות/ראשי/עתודה/מסלול-אקדמיזציה", { d: null, m: 21, g: "all", tier: "standard", comp: "high", len: "שירות חובה מלא (דין אישה כדין גבר) + 24 חודשי קבע", req: ["תואר ראשון בתחום נדרש, ממוצע 75+", "סיווג סודי ביותר", "ראיונות ינואר-מאי"] }],
  ["מסלול אדרים", "אוויר / קצונה טכנית", false, ["electronics", "mechanics", "leadership", "aviation"], ["קצונה טכנית בחיל האוויר", "תואר רב-תחומי באוניברסיטת חיפה"], "technical officers with a BA for the Air Force", "/roles/מסלול-אדרים/", { d: 60, m: 64, g: "all", tier: "standard", comp: "high", len: "40 חודשי הכשרה + 3 שנים ו-4 חודשי קבע", req: ['דפ"ר 60', "פרופיל 64", '4 יח"ל מתמטיקה ואנגלית'] }],
  ["תוכנית ארז", "קצונה / לחימה", true, ["combat", "leadership", "research", "fitness"], ["קציני לחימה עם תואר", "שנת לחימה ואז תואר כפול בת\"א", "4 שנות קבע"], "combat officers with an embedded BA (unit 169)", "https://www.idf.il/אתרי-יחידות/תוכנית-ארז/", { d: null, m: 82, g: "male_only", tier: "elite", comp: "very_high", len: "כ-6 שנים ו-8 חודשים סה\"כ; 4 שנות קבע", req: ["מיון ברמת סיירות", "פרופיל 82 ומעלה"] }],
  // IAF / Navy / combat
  ['רכז/ת שליטה קרקעית (קשל"ט)', "אוויר / מבצעים", false, ["aviation", "operations", "war-room", "attention-to-detail"], ["שליטה קרקעית בבסיסי חיל האוויר", "בסיס סגור"], "ground control coordinators at air bases", "/roles/", { d: 50, m: 45, g: "all", tier: "standard", comp: "medium", len: "", req: ["פרופיל 45 ומעלה"] }],
  ['לוחמות טנקים בגדודי חי"ר גבולות', "לחימה / בט״ש", true, ["combat", "mechanics", "fitness", "fieldwork"], ["טנקים בגדוד קרקל", "4 חודשי רובאות + 5 שבועות מקצועות + 8 שבועות צוות", "נשים בלבד"], "women tank crews in border battalions", "/תפקידים/לוחמות-טנקים-בגדודי-חיר-גבולות/", { d: null, m: 72, g: "female_only", tier: "standard", comp: "high", len: "32 חודשים + מילואים", req: ["מיון לוחמות", "גובה 1.65 מ' ומשקל 60 ק\"ג לפחות", "פרופיל 72 ומעלה"] }],
  ["חובש/ת קדמי/ת", "רפואה", false, ["medicine", "emergency", "helping-people", "fieldwork"], ["קורס חובשים 3 חודשים בבה\"ד 10", "מרפאות ויחידות קדמיות"], "forward medics (non-combat enlistment)", "/roles/חובשת-קדמית/", { d: 50, m: 64, g: "all", tier: "standard", comp: "high", len: "טירונות 02 + 3 חודשי קורס; גברים 32, נשים 24", req: ["פרופיל 64 ומעלה", 'דפ"ר 50 ומעלה', "עברית 8", "סיכויי שיבוץ נמוכים"] }],
];

// ---------- apply ----------
const before = catalog.roles.length;
const removeSet = new Set(REMOVE);
catalog.roles = catalog.roles.filter((r) => !removeSet.has(r.roleTitle));
const removed = before - catalog.roles.length;
for (const t of REMOVE) if (enrich.overrides[t]) delete enrich.overrides[t];

let fixed = 0;
for (const r of catalog.roles) {
  const fix = FIX[r.roleTitle];
  if (!fix) continue;
  if (fix.roleTitle && enrich.overrides[r.roleTitle]) {
    enrich.overrides[fix.roleTitle] = enrich.overrides[r.roleTitle];
    delete enrich.overrides[r.roleTitle];
  }
  Object.assign(r, fix);
  fixed++;
}

const titles = new Set(catalog.roles.map((r) => r.roleTitle));
let added = 0;
for (const [title, category, combat, tags, signals, bestFor, src, e] of ADD) {
  const source = src.startsWith("http") || !src.startsWith("/") ? src : `${M}${src}`;
  if (!titles.has(title)) {
    catalog.roles.push({
      roleTitle: title,
      category,
      combat,
      selective: e.comp !== "low",
      preferenceTags: tags,
      signals,
      bestFor: `Good fit for: ${bestFor}`,
      aiRecommendationHint: `Suggest when the user likes ${tags.join(", ")}.${combat ? " Combat role: present neutrally with the official-eligibility caveat." : ""}`,
      validationLevel: "official_public_validated",
      validationSource: source,
    });
    titles.add(title);
    added++;
  }
  if (!enrich.overrides[title]) {
    const o = {
      daparFloor: e.d,
      medicalFloor: e.m,
      genderEligibility: e.g,
      tier: e.tier,
      competitiveness: e.comp,
      requirements: e.req,
      enrichment: { status: "reviewed", confidence: "high", enrichedAt: "2026-10-08", source },
    };
    if (e.len) o.serviceLengthLabel = e.len;
    if (e.maleMax) o.maleMedicalMax = e.maleMax;
    enrich.overrides[title] = o;
  }
}

catalog.roleCount = catalog.roles.length;
catalog.roles.sort((a, b) => a.category.localeCompare(b.category, "he") || a.roleTitle.localeCompare(b.roleTitle, "he"));
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2) + "\n");
console.log(`removed ${removed}, fixed ${fixed}, added ${added}, now ${catalog.roles.length} roles, ${Object.keys(enrich.overrides).length} overrides`);
const missingRemove = REMOVE.filter((t) => !catalog.roles.some((r) => r.roleTitle === t) && removed < REMOVE.length);
if (removed < REMOVE.length) console.log("not found (already removed or different spelling):", REMOVE.length - removed);
