# IDF facts vs. what kachkivun.com asks and promises

Compiled 2026-10-08 from six research passes (full notes with URLs in `docs/research/01` to `06`). Scope: the live product only, the 5-role AI suggester plus the ₪10 unlock of ranks 1 and 2.

Rule of thumb that came out of the research: **mitgaisim.idf.il publishes profile, דפ"ר, Hebrew level and מא"ה minimums per role, and sometimes course length and bases. It never publishes קב"א, יציאות or service length per role.** Anything we show about those three is either derived from law (service length) or unofficial (יציאות).

## 1. Things we ask the user that we cannot honor today

These are the "ask X, deliver the opposite" cases. The engine code already supports the data fields; the data is simply missing for all 302 roles.

| We ask | What happens now | Why it fails | Fix |
|---|---|---|---|
| "איזו מערכת יציאות מתאימה לכם?" (7 options) | Ignored. `exitsFit` returns null because no role has `exitPatterns` (`server/utils/roleScoring.js:314`) | The IDF does not map roles to יציאות at all (mitgaisim "מתי יוצאים הביתה?"). The only official per-role fact is **בסיס סגור / בסיס פתוח**, which appears on most IAF, Navy and אמ"ן role pages | Replace the question with "בסיס סגור או פתוח?" (3 options: פתוח, סגור, לא משנה) and add `closedBase: true/false` per role from mitgaisim. Keep יציאות only as an explanatory tooltip with the official definitions and an "unofficial, varies by unit" label |
| Avoid "שמירות / לילות" | Ignored: needs `hasNightDuty` on the role; none has it | Shift work is stated officially for some roles (בקרה אווירית, מכלול הגנה קרקעית, בקרית שליטה ימית, בכיר ערבית/פרסית, מיישם הגנה בסייבר) | Set `hasNightDuty` on those roles; otherwise drop the option |
| Avoid "רחוק מהבית" | Ignored: needs `closedBase` or `remotePosting` | Same as row 1, בסיס סגור is the official proxy | Same `closedBase` data |
| Interest "8200 / סייבר" | Matches only roles tagged `cyber` (10 roles, mostly תקשוב defense). There is no 8200 role in the catalog and the user never sees 8200 | mitgaisim never names 8200; its tracks are אמנון, אח"מ, אח"מ פיתוח, אע"מ, מט"מ, גאמ"א, אופק, בכיר ערבית/פרסית, שחקים. None of these except גאמ"א and שחקים exist in our catalog | Add the אמ"ן tracks (section 4). Rename the option to "מודיעין וסייבר (8200 ואחרים)" and tag אמ"ן tracks `intelligence` + `cyber` |
| Interest "חיל האוויר" / "חיל הים" | Matches tags `aviation`/`drones` and `sea` only | OK in principle, but the catalog lists roles that do not exist (section 5) and misses common ones (פקמ"צית, קשל"ט, מכלול הגנה קרקעית, גוררות as is) | Clean up per section 5 |
| דפ"ר 10 to 90 | Fine | Matches the official scale | Keep |
| פרופיל 21/45/64/72/82/97 | **Missing 70** | New profile 70 introduced Sept 2026 for new מלש"בים (between 64 and 72; opens תותחנים, הגנ"א, IAF; not חי"ר) | Add 70 to `MEDICAL_PROFILES` in `server/utils/assessmentValues.js` and the UI; treat it as 72 minus חי"ר for gating |
| "12 ממדי מא״ה", 12 sliders | Shown as a fact | Official ability list names **11** abilities; the official לומדה says "12 סביבות"; role pages also use גמישות מחשבתית and קשב מתמשך. Our 12 keys match the official 11 plus a split of "קשב" into קשב מתמשך and "זריזות, יעילות ודיוק" which is not an official name | Rename `speedAndAccuracy` to גמישות מחשבתית or label the set "כ-12 ממדים" with a caveat. Keep the "two exercises per dimension" claim: confirmed verbatim, plus "two assessors" |
| Combat branch: 3 km, מתח, שכיבות | Fine as self-report | יום סיירות uses a 1 to 1.5 km run cutoff and sandbag drills; גיבוש צנחנים entry test is 3 km under 15 min | Keep; show the צנחנים 15-minute line as the reference |
| Free text "משהו נוסף" | Not used by the engine | | Either feed it to the AI prompt (cheap) or remove |

## 2. Copy claims to fix

| Where | Says | Reality | Change to |
|---|---|---|---|
| `src/routes/index.tsx:147-197`, `about.tsx:97` | "+120 תפקידים" | Catalog has 302 | "300+ תפקידים ומסלולים" (after the cleanup in section 5, use the real count) |
| `index.tsx:197` | "מציג אחוזי דיוק" | Percentages are deterministic fit scores squeezed into 42 to 94 | "ציון התאמה" and never "דיוק" |
| `server/utils/roleScoring.js:614` | "רוב תפקידי הלחימה (כולל הנדסה קרבית וחי״ר) דורשים פרופיל 82" | Only חי"ר, סיירות and הנדסה קרבית need 82. Profile 72 opens שריון, תותחנים, הגנ"א, חילוץ והצלה, חי"ר גבולות (incl. קרקל, ברדלס), מג"ב (with סעיף מתיר), לוחם איסוף (72 possible). 64 opens מעברים | "חי״ר, סיירות והנדסה קרבית דורשים 82. עם 72 פתוחים שריון, תותחנים, הגנה אווירית, חילוץ והצלה וחי״ר גבולות" |
| `roleScoring.js:48, 511` | Profile below 64 hard-blocks every combat role | Correct per official ladder | Keep; add that 70 (new) behaves like 72 minus חי"ר |
| `content/he/yom-hameah-explainer.txt` | "חמישה ממדים מאוחדים" | The app uses 12; official list is 11 | Rewrite to the official 11 (+ caveat) |
| Assessment review `AssessmentCheckpoint.tsx:396` | "ביטחון בנתוני הקלט 94%" formula | Fine as UX, but the word "ביטחון" plus a percentage reads like accuracy | Label "שלמות הנתונים" |
| Terms `terms.tsx:59-60` | "הפרופיל הרפואי משמש לחישוב סף התאמה בלבד" | True | Keep |
| Ad script `scripts/generate_ads.py:154, 165` | "פלטפורמה רשמית", "94% דיוק" | False and risky | Delete those strings before any campaign |

## 3. Facts the AI and the UI should carry (verified)

**Service length (law as of July 2026)**
- Men: 32 months for everyone drafted July 2024 through June 2029 (תיקון 29 והוראת שעה). Reverts to 30 for the June 2029 cohort unless amended. 36 months never became law.
- Women: 24 months, or 32 in any "דין אישה כדין גבר" role: all combat tracks, and most אמ"ן and בסמ"ח tech tracks (תוכניתן, מגן סייבר, בודק תוכנה, DevOps, לה"ב, 8200 tracks). ~23% of women now sign it.
- קבע on top, by role (official pages): תוכניתן 2.5 y, מגן סייבר 2 y, לה"ב מצו"ב 2.5 to 3 y, DevOps 1 y, גאמ"א / אמנון / אח"מ פיתוח 3 y, אח"מ 1.5 y, אגו"ז 4 months, אע"מ / אמ"מ / שמ"מ 0.5 y, שלדג 18 months, סיירת מטכ"ל 3 y, דובדבן 1 to 7 y, חובלים 5 y, טיס 7 y, רקיע 18 months, עתודה 3 y, אקדמיזציה 2 y. QA, דאטא אנליסט, מנהל DC, בה"ד 7 roles: none stated.

**Scales**
- דפ"ר 10 to 90 in tens; mean ~50; retake only if ≤70. Tech/intel threshold on official pages is 60 (70 for תוכניתן, מגן סייבר, DevOps, לה"ב, מט"ס, פס"י, אגו"ז, מת"ן; 80 to 90 for שחקים; 90 for תלפיות). Combat-profile men need 80 + 10 units for אשכול מקצועות המחשב.
- קב"א: most teens no longer see a number (replaced by 4 descriptive התאמה-לקצונה levels in 2022). Do not require it.
- Profile ladder: 97 everything incl. elite; 82 field units and חי"ר; 72 all combat except חי"ר and סיירות; **70 (new Sept 2026)** between 64 and 72; 64 תומכי לחימה + מעברים; 45 rear; 25/24/21 unfit variants. BMI 17-32 infantry, 18-32 elite, 17-35 combat support.
- יום המא"ה: online, run by civilian institutes, 1 to 5 per ability, each score from at least two exercises and two assessors. Does not replace צו ראשון. Skipping it means no שאלון העדפות and no pre-army מיונים.

**Timeline (grade י"א to draft)**
- צו ראשון at ~16.5. יום המא"ה after. שאלון העדפות opens September of י"ב (three versions: combat men, rear men, women). Up to 3 מיונים at once.
- Windows: יום סיירות Oct and Jan; גיבוש אחוד (מטכ"ל/שלדג) Nov and Mar; גיבוש צנחנים Apr/Aug/Dec; גיבוש טיס Feb/Mar and Oct/Nov; אשכול מקצועות המחשב ~twice a year; כלל חמ"ן waves Jun-Oct and Feb-Apr; עתודה questionnaire July to 28 Feb, psychometric by April, יום חיול October.
- New from the Aug-2026 cohort: "שיבוץ עם גמישות", an early קביעה placement in י"ב that a passed מיון overrides; not for combat-designated men.
- Appeals: "בקשה מנומקת למיטב" (1111). There is no "ועדת שיבוץ" for מלש"בים.

**The combat-profile trap (the thing you asked about)**
- A man with profile 72, 82 or 97 is "מיועד ללוחמה". He receives the combat version of שאלון העדפות; rear roles are not in it. Rear role pages say "מיועד לגברים בעלי פרופיל עורפי ולנשים".
- Ways to a tech role anyway: pass an eligibility מיון that accepts combat profiles (שחקים at the top of דפ"ר 90, גאמ"א, חבצלות, אשכול מקצועות המחשב with דפ"ר 80 + 10 units, עתודה, IAF tracks, קצונה ייעודית), or a medical appeal, or an exceptional request to מיטב.
- Since 26 June 2024 אכ"א cut the quotas of combat-profile men sent to 8200/81/תקשוב by "מאות תקנים". No reversal found; 2026 shortage (~12,000 conscripts) points the same way.
- Women have no equivalent problem: combat is opt-in for them.

## 4. Catalog: what to add

Missing high-demand tracks (all on mitgaisim, see research 02/03/04/06 for thresholds):
- אמ"ן: מסלול אמנון, מסלול אח"מ, מסלול אח"מ פיתוח, מסלול אע"מ, מסלול אמ"מ, מסלול מח"א, מסלול שוב"ל, מסלול שמ"מ (we list these as sub-rows of שחקים without their own data), מסלול מט"מ, מסלול אופק, מסלול בכיר לדוברי ערבית, מסלול בכיר לדוברי פרסית, מסלולי ערבית, מסלול ממ"ש, מסלול אניגמה מחשבים, מסלול רומא, מסלול נץ, חוקר מודיעין טכנולוגי, אנליסט ביטחוני, מש"ק מערך, לוחם אתגרים, זרם חזק 8200.
- תקשוב: מט"ס, SRE, דאטא אנליסט, מנהל DC, פס"י, מכינת מקצועות המחשב, טכנאי סיסטם, מפעיל דיגיטל מבצעי, מש"ק שליטה בדיגיטל, בקר רשת, רכז שירותי תקשוב, קצונה ייעודית מבצעית בחיל התקשוב.
- עתודה: רעמים, סילון, גבישים, אביבים, גלקסיה, ביו, צמרת, בינה, פסגה (סיעוד); אקדמיזציה as its own entry; אדרים; ארז.
- IAF/Navy: פקמ"צית (we have it), קשל"ט, מפעיל מכלול הגנה קרקעית (we have), גיבוש לוחם חוד ימי as the gate for סטי"ל/דבור, אתי"ם (rename אלחוטנית חוף), חובש קדמי.
- Women's combat: לוחמת חי"ר גבולות (single entry covering קרקל, ברדלס, אריות הירדן, לביא הבקעה, פנתר), לוחמות טנקים בגדודי חי"ר גבולות.

## 5. Catalog: what to remove or rename

Not found on mitgaisim or any reliable source as a draftee role (69 of our 302 are "seed_normalized", i.e. never validated):
- Cyber/תקשוב: מנטר/ת אירועי סייבר (function is מיישם הגנה בסייבר), מפעיל צופן פענוח רשת (צפ"ר), מש"ק מט"ל, אבנט כחול, מפעיל/ת תקשורת נתונים (legacy; use טכנאי רשתות ודיגיטל), מנהל/ת מערכות Linux, מנהל/ת מערכות Windows, תומך/ת Help Desk (use מנהל רשת, DevOps-IT, מנהל DC, רכז שירותי תקשוב), חוקר/ת פורנזיקה דיגיטלית (inside מגן סייבר), מפעיל מרכז שליטה מבצעית – חטיבת הסייבר-סיגינט.
- מודיעין: אנליסט/ית סיגינט, חוקר/ת מודיעין ממקורות גלויים, חוקר/ת רשתות חברתיות, מפענח/ת תצלומי אוויר (inside מופ"ת), רכז/ת מודיעין, חוקר/ת מודיעין מטרות, מפענח/ת תת קרקע, ממפה/ת מבצעי/ת, חוקר/ת מודיעין גאוגרפי (אגו"ז covers it), יום מיון למסלולי כלל חמ"ן (a screening, not a role).
- IAF/Navy: מש"ק/ית תיאום אווירי, רכז/ת מבצעים בחיל האוויר, חובש/ת תעופתי/ת, חובש/ת ימי/ת, מכשירנית ימית and טכנאי מערכות ימיות (pages 404), מכונאי/ת מוטס/ת (not draft-entry), מפעיל/ת כטמ״ם as a combat draft role (internal operators are officers; the draft role is מטיס חוץ).
- Category errors: מסלול גאמ״א is אמ"ן, not "סייבר וטכנולוגיה/תקשוב"; מרום טכנולוגי and תכנית סיגמא are אמ"ן/IAF technician tracks, not תקשוב; מגן/ת סייבר belongs to אגף התקשוב, not 8200; מסלול תלפיות, חבצלות, ארזים are in-service programs, not עתודה; לוחם לוחמה אלקטרונית is an IAF role (מפעיל ל"א, profile 72); עתודה לפסיכולוגיה is unconfirmed for 2026.
- Women-only tags to add: פקמ"צית, מדריכת סימולטור, מאבחנת צוות אוויר, מדריכת פיזיולוגיה, בקרית שליטה ימית, מאמנת סימולטור ח"י, תצפיתנית, לוחמות טנקים גבולות, רקיע. Men-only: צוללן, שייטת 13, 669, שלדג, דבורן, הנדסה קרבית, גולני/גבעתי/צנחנים/נח"ל/כפיר, קומנדו, לוחם אתגרים.
- Profile ceilings for men (official): בקרה אווירית, פקח טיסה, חוקרת מודיעין אוויר/ימי, אתי"ם, טכנאי רשתות, מגן טופז, מדריך תקשוב cap men at 64; women uncapped. This is the data behind the "high profile, fewer rear roles" effect and should gate.

## 6. Personalized insight moments for the onboarding

Each fires from answers already collected, shows one chart, and is sourced. All numbers below are from official pages unless marked.

1. **Male, profile 82 or 97, direction = technology or interest in cyber/intel**
   "עם פרופיל {p} אתה מיועד ללוחמה. שאלון ההעדפות שתקבל הוא גרסת יחידות השדה, ותפקידי עורף לא יופיעו בו. הדרך לטכנולוגיה עוברת דרך מיונים: אשכול מקצועות המחשב (דורש דפ״ר 80 ו-10 יח״ל טכנולוגיות לבעלי פרופיל קרבי), שחקים, גאמ״א, עתודה או חיל האוויר. מאז יוני 2024 צה״ל צמצם משמעותית את מכסות בעלי הפרופיל הקרבי ב-8200 ובתקשוב."
   Chart: horizontal bars "סיכוי מסלול" by route (qualitative: אשכול, שחקים, גאמ"א, עתודה, IAF, שאלון בלבד) with the דפ"ר gate for each, highlighted by the user's דפ"ר.
2. **Male, profile 72, interest in combat / wants גולני-style infantry**
   "פרופיל 72 לא מאפשר חי״ר וסיירות (גולני, גבעתי, נח״ל, צנחנים, כפיר, קומנדו). כן פתוחים: שריון, תותחנים, הגנה אווירית, חילוץ והצלה, חי״ר גבולות ומג״ב (עם סעיף מתיר)."
   Chart: ladder of profiles 45/64/70/72/82/97 with the user's rung lit and the role families that open at each rung.
3. **Profile 64 or 70, interest in combat**
   70: "פרופיל 70 חדש (ספטמבר 2026) פותח תותחנים, הגנה אווירית וחיל האוויר, לא חי״ר." 64: "פתוחים תומכי לחימה ולוחם מעברים; חילוץ והצלה דורש 72."
4. **Female, interest in combat**
   "לוחמה לנשים היא בחירה: תדרגי אשכול לוחמה, תעברי מיון לוחמות (BMI, שיחות, בלי מבחן פיזי) ותתחייבי ל-32 חודשים ומילואים. פתוחים: חי״ר גבולות (קרקל, ברדלס, אריות הירדן, לביא הבקעה, פנתר), טנקים בגבולות, תותחנים, הגנה אווירית, חילוץ והצלה, איסוף קרבי, מג״ב, ל״א. סגורים: חטיבות החי״ר המתמרנות והקומנדו. פלוגת טנקים מתמרנת ראשונה לנשים נפתחת בנובמבר 2026."
   Chart: 24 vs 32 months bar.
5. **Interest 8200/intel and דפ"ר < 60**
   "יום המיון לכלל חמ״ן מזמין בדרך כלל דפ״ר 60 עד 70. עם דפ״ר 50 פתוחים מסלולי השפות (ערבית, פרסית) ומסלול אניגמה." If the user is a combat-designated man: "כלל חמ״ן אינו מזמין בנים המיועדים ללוחמה."
6. **דפ"ר ≥ 70 and tech**
   "דפ״ר 70 עומד בסף של תוכניתן, מגן סייבר, DevOps ולה״ב מצו״ב. שים לב להתחייבות: תוכניתן 2.5 שנות קבע, מגן סייבר 2, DevOps שנה. לנשים: 32 חודשים."
   Chart: timeline bar per role: 32 months חובה + קבע.
7. **Any user with a draft date**
   A dated roadmap from today to the draft: שאלון העדפות (Sept), מיוני אשכול (~Jan/Jul), כלל חמ"ן waves, יום סיירות (Oct/Jan), גיבושים (Nov/Mar), עתודה deadline 28 Feb, שיבוץ notice (~June or ~October). This is the "feels personalized" chart with the least risk, since the windows are documented.
8. **Exits question (if kept)**
   "צה״ל לא מפרסם מערכת יציאות לפי תפקיד. מה שכן רשמי: בסיס סגור או פתוח. רוב תפקידי חיל האוויר, חיל הים ואמ״ן הם בבסיס סגור; תפקידי בה״ד 7 ותקשוב בדרך כלל 'בבסיסים ברחבי הארץ'."

## 7. Prompt facts for the AI copywriter

Add to `buildSystemPromptV3` (and v2) a short "verified facts" block so the model stops inventing: service lengths above, the profile ladder incl. 70, the combat-profile trap, "8200 is never named officially; use the track names", "קב"א is not shown to most candidates", "no יציאות per role". Also fix `nextStepPrompts`: they should be questions the teen can ask מיטב or a unit rep ("מתי חלון המיונים הבא לאשכול מקצועות המחשב?"), not interview questions to the teen.

## 7b. Corrections from Michael (first-hand, 2026-10-08)

- **קב"א no longer exists** for candidates. Remove every קב"א mention from UI, catalog requirement strings (e.g. מדריך/ת ERP "קב"א 52 ומעלה") and prompts.
- **The real יום המא"ה set is 11 scores:** סביבת הדרכה, סביבת טיפול באדם, סביבת טכני-פעולה (הפעלה טכנית), סביבת מנהל וארגון, סביבת עיבוד מידע, מדד פיקוד, מדד עבודת צוות, השקעה והתמדה, התנהגות מסגרתית, בגרות ובשלות, תפיסה מרחבית.
  Versus our 12 keys: `sustainedAttention` (קשב מתמשך) and `speedAndAccuracy` (זריזות, יעילות ודיוק) **do not exist** and must go; `disciplineMaturity` must split into התנהגות מסגרתית and בגרות ובשלות. Net: 12 → 11 keys. This touches `yom-hameah-12.ts`, `yomHameah12Keys.js`, the sliders, the radar chart, `role-enrichment-v3.json` keyDimensions, `deriveKeyDimensions`, saved MilitaryStats documents (migration), and the AI prompt (gpt-4o already cites "קשב מתמשך 4/5" in descriptions, which is a made-up dimension to the user).

## 8. Open items to verify manually (fetch failed or sources conflict)
- Profile 70 effective date and whether it opens שריון.
- Official "שיבוץ עם גמישות" page.
- idf.il pages for 8200/9900/504 and the כלל חמ"ן request article.
- קבע for שייטת 13, 669, צוללות (official pages silent).
- Whether the June 2024 combat-profile quota cut is still formal policy in 2026.
- 11 vs 12 מא"ה abilities.
- עתודה 2027-28 brochure (not published yet).
