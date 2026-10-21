import test from "node:test";
import assert from "node:assert/strict";
import {
  VERIFIED_FACTS_HE,
  buildMatchUserPrompt,
  buildSystemPromptV2,
  countAiPicks,
  finalizeRolesV2,
  parsePersonalAnswer,
  parseRolesArray,
} from "../controllers/aiController.js";

const pool = [
  { roleTitle: "מגן/ת סייבר", basePercent: 90, category: "סייבר", dayToDay: "" },
  { roleTitle: "חובש/ת קרבי/ת", basePercent: 85, category: "רפואה / לחימה", combat: true, dayToDay: "" },
  { roleTitle: "תוכניתן/ית", basePercent: 80, category: "תוכנה", dayToDay: "כתיבת קוד" },
  { roleTitle: "לוחם/ת ילת״ם", basePercent: 75, category: "חילוץ", combat: true, dayToDay: "" },
  { roleTitle: "מש״ק/ית ת״ש", basePercent: 60, category: "משאבי אנוש", dayToDay: "" },
  { roleTitle: "לוחם שריון", basePercent: 55, category: "שריון", combat: true, dayToDay: "" },
];
const pick = (roleTitle, adjustment = 0) => ({ roleTitle, adjustment, description: `למה ${roleTitle}` });

test("the model's order stands and the percentages still go down", () => {
  const raw = [pick("מש״ק/ית ת״ש", 8), pick("מגן/ת סייבר"), pick("תוכניתן/ית"), pick("לוחם שריון"), pick("לוחם/ת ילת״ם")];
  const out = finalizeRolesV2(raw, pool);
  assert.deepEqual(
    out.map((r) => r.roleTitle),
    raw.map((r) => r.roleTitle),
  );
  for (let i = 1; i < out.length; i++) assert.ok(out[i].matchPercentage < out[i - 1].matchPercentage);
  assert.equal(out[0].matchPercentage, 90, "the top blended score goes to the model's #1");
});

test("titles without the gender suffix resolve", () => {
  const raw = [pick("חובש קרבי"), pick('לוחם ילת"ם'), pick("מגן סייבר"), pick("תוכניתן"), pick("לוחם שריון")];
  assert.equal(countAiPicks(raw, pool), 5);
  assert.deepEqual(
    finalizeRolesV2(raw, pool).map((r) => r.roleTitle),
    ["חובש/ת קרבי/ת", "לוחם/ת ילת״ם", "מגן/ת סייבר", "תוכניתן/ית", "לוחם שריון"],
  );
});

test("an invented or repeated title counts short, so the answer is retried", () => {
  const invented = [pick("קבלה מובטחת ל-8200"), pick("מגן/ת סייבר"), pick("תוכניתן/ית"), pick("לוחם שריון"), pick("לוחם/ת ילת״ם")];
  const repeated = [pick("מגן/ת סייבר"), pick("מגן סייבר"), pick("תוכניתן/ית"), pick("לוחם שריון"), pick("לוחם/ת ילת״ם")];
  assert.equal(countAiPicks(invented, pool), 4);
  assert.equal(countAiPicks(repeated, pool), 4);
  assert.equal(countAiPicks(null, pool), 0);
});

test("a padded card sits after the model's picks and is never blank", () => {
  const raw = [pick("לוחם שריון", -8), pick("מש״ק/ית ת״ש"), pick("קבלה מובטחת ל-8200")];
  const out = finalizeRolesV2(raw, pool);
  assert.deepEqual(
    out.map((r) => r.roleTitle),
    ["לוחם שריון", "מש״ק/ית ת״ש", "מגן/ת סייבר", "חובש/ת קרבי/ת", "תוכניתן/ית"],
  );
  for (const role of out) {
    assert.ok(role.description, `${role.roleTitle} has a description`);
    assert.ok(role.summary, `${role.roleTitle} has a summary`);
    assert.ok(!role.description.includes("\u2014"));
  }
  assert.equal(out[4].description, "כתיבת קוד", "day-to-day text comes first");
  assert.equal(out[3].description, "תפקיד קרבי בתחום רפואה / לחימה.");
  for (let i = 1; i < out.length; i++) assert.ok(out[i].matchPercentage < out[i - 1].matchPercentage);
});

const base = {
  engine: "v2",
  profileForMatch: { daparScore: 70, medicalProfile: 97 },
  preferences: { combatPreference: "FieldCombat", focus: "Tech", physicalActivityLevel: "High" },
  yom: null,
  stats: {},
  filteredRoleCount: 6,
  assessmentSignals: {
    rolesInterested: ["cyber", "combat"],
    rolesAvoided: ["guard_duty_nights"],
    basePreference: "open",
    environment: "mixed",
    leadership: "prefer_team",
    stress: "high",
    motivations: ["contribution"],
    focusExtra: ["Physical"],
    technicalDetails: { level: "basic", areas: ["programming"] },
    combatDetails: { run3kmBand: "over_15", pullUpsBand: "0_to_5", pushUpsBand: "0_to_30", readiness: "unsure" },
  },
};

test("the v2 prompt speaks Hebrew, not enums, and models no invented trait", () => {
  const prompt = buildMatchUserPrompt(base);
  for (const raw of ["FieldCombat", "High", "guard_duty_nights", "over_15", "prefer_team", '"rolesInterested":']) {
    assert.ok(!prompt.includes(raw), `no raw ${raw}`);
  }
  assert.ok(!prompt.includes("היתרון האתלטי"));
  assert.ok(prompt.includes("כיוון קרבי / שטח"));
  assert.ok(prompt.includes("רמת פעילות גופנית שהמועמד/ת מעדיף/ה (העדפה, לא יכולת): גבוהה"));
  assert.ok(prompt.includes('ריצת 3 ק"מ: מעל 15 דקות; עליות מתח: 0 עד 5'));
  assert.ok(prompt.includes("שמירות / לילות") && prompt.includes("מעדיף/ה להיות חלק מצוות"));
  assert.ok(!prompt.includes("\u2014"));
  assert.ok(buildMatchUserPrompt({ ...base, assessmentSignals: {} }).includes("(combatDetails): לא נמסר"));
});

test("a requested role the gates closed is named with its reason", () => {
  assert.ok(!buildMatchUserPrompt(base).includes("תפקידים סגורים"));
  const prompt = buildMatchUserPrompt({
    ...base,
    personalRequest: "רוצה 669",
    blockedRequested: [{ roleTitle: "לוחם 669", reasons: ["התפקיד אינו פתוח למגדר הנבחר"] }],
  });
  assert.ok(prompt.includes("(ייתכן שהבקשה לא מתכוונת אליהם): לוחם 669: התפקיד אינו פתוח למגדר הנבחר"));
  assert.ok(prompt.includes("בלי להזכיר באותו משפט אף תפקיד מהחמישה"));
  assert.ok(prompt.includes("שהוא סגור בפני המועמד/ת ולמה"));
});

test("a short answer counts short, and an all-padding result still has five full cards", () => {
  const four = [pick("מגן/ת סייבר"), pick("תוכניתן/ית"), pick("לוחם שריון"), pick("לוחם/ת ילת״ם")];
  assert.equal(countAiPicks(four, pool), 4);
  const out = finalizeRolesV2([], pool);
  assert.equal(out.length, 5);
  assert.ok(out.every((r) => r.description && r.summary && !r.description.includes("undefined")));
  for (let i = 1; i < out.length; i++) assert.ok(out[i].matchPercentage < out[i - 1].matchPercentage);
});

test("the prompt states gender, unknown thresholds and an empty note plainly", () => {
  const plain = buildMatchUserPrompt(base);
  assert.ok(plain.includes("- מגדר: לא צוין"));
  assert.ok(!plain.includes("<request>"), "no note, no request block");
  assert.ok(buildMatchUserPrompt({ ...base, profileForMatch: { ...base.profileForMatch, gender: "female" } }).includes("- מגדר: בת"));
  const unknown = buildMatchUserPrompt({ ...base, profileForMatch: { daparScore: "unknown", medicalProfile: "unknown", gender: "male" } });
  assert.ok(unknown.includes('- דפ"ר: לא ידוע') && unknown.includes("- פרופיל רפואי: לא ידוע"));
  assert.ok(unknown.includes("- מגדר: בן"));
});

test("the pool entry carries the same base fact the card shows", () => {
  const prompt = buildSystemPromptV2([
    { roleTitle: "לוחם שריון", closedBase: true },
    { roleTitle: "מש״ק/ית ת״ש", closedBase: false },
    { roleTitle: "תוכניתן/ית" },
  ]);
  assert.ok(prompt.includes('"roleTitle":"לוחם שריון"') && prompt.includes('"base":"בסיס סגור"'));
  assert.ok(prompt.includes('"base":"בסיס פתוח"'));
  assert.equal(prompt.match(/"base":/g).length, 2, "no base claim for a role without the fact");
});

test("a bare gershayim in the model's JSON is repaired, not a 502", () => {
  // Fragments of the live outputs that failed both attempts (6acbfbeb, 6acdc8e9): דפ"ר and גדנ"ע unescaped.
  const titles = pool.slice(0, 5).map((r) => r.roleTitle);
  const raw = `{"roles":[${titles
    .map((t) => `{"roleTitle":"${t}","adjustment":0,"description":"התפקיד דורש דפ"ר 50 ומעלה, פרופיל 64 ומעלה."}`)
    .join(",")}],"personalAnswer":"לתפקיד נדרשים יום סיירות או גדנ"ע צלילה. ציון דפ\\"ר אינו סף לקצונה."}`;
  assert.throws(() => JSON.parse(raw));
  const roles = parseRolesArray(raw);
  assert.equal(roles?.length, 5);
  assert.equal(roles[0].description, "התפקיד דורש דפ״ר 50 ומעלה, פרופיל 64 ומעלה.");
  assert.equal(countAiPicks(roles, pool), 5);
  assert.equal(parsePersonalAnswer(raw), 'לתפקיד נדרשים יום סיירות או גדנ״ע צלילה. ציון דפ"ר אינו סף לקצונה.');
});

test("near-miss titles resolve: no ב in לוחם בגבעתי, מש\"ק/ית for מש\"קית", () => {
  const real = [
    { roleTitle: "לוחם בגבעתי", basePercent: 80 },
    { roleTitle: "לוחם בסיירת חטיבתית", basePercent: 78 },
    { roleTitle: "מש״קית שירותי רפואה", basePercent: 70 },
    ...pool,
  ];
  const raw = [pick("לוחם גבעתי"), pick("לוחם סיירת חטיבתית"), pick('מש"ק/ית שירותי רפואה'), pick("מגן סייבר"), pick("לוחם שריון")];
  assert.equal(countAiPicks(raw, real), 5);
  assert.deepEqual(finalizeRolesV2(raw, real).slice(0, 3).map((r) => r.roleTitle), [
    "לוחם בגבעתי",
    "לוחם בסיירת חטיבתית",
    "מש״קית שירותי רפואה",
  ]);
});

test("our own prompt words never reach a card or the answer", () => {
  const raw = [
    {
      ...pick("תוכניתן/ית"),
      summary: "לפי הרשומה זה מתאים.",
      description: "לפי הרשומה, התפקיד מחייב 32 חודשים. עבודה במאגרי מידע היא לב התפקיד.",
    },
    { ...pick("מגן/ת סייבר"), description: "שורת הכושר שדיווחתם עליה בינונית. אין בנתונים שלי תנאי סף." },
    pick("לוחם שריון"),
    pick("לוחם/ת ילת״ם"),
    pick("מש״ק/ית ת״ש"),
  ];
  const [prog, cyber] = finalizeRolesV2(raw, pool);
  assert.equal(prog.description, "עבודה במאגרי מידע היא לב התפקיד.");
  assert.equal(prog.summary, "עבודה במאגרי מידע היא לב התפקיד.");
  assert.equal(cyber.description, "תפקיד בתחום סייבר.", "all meta: the fallback, never blank");
  const answer = parsePersonalAnswer(
    String.raw`{"roles":[],"personalAnswer":"מגן/ת סייבר פתוח בפניכם. הוא בסיס סגור לפי השדה הרשמי.\nתוכניתן/ית דורש דפ״ר 70."}`,
  );
  assert.equal(answer, "מגן/ת סייבר פתוח בפניכם.\nתוכניתן/ית דורש דפ״ר 70.");
  // A decimal point is not a sentence end, and the neighbours keep their space.
  const pa = (text) => parsePersonalAnswer(JSON.stringify({ roles: [], personalAnswer: text }));
  assert.equal(pa("קבע אחד. לפי הרשומה ההתחייבות 2.5 שנים. תוכניתן/ית פתוח."), "קבע אחד. תוכניתן/ית פתוח.");
  // An answer made only of our wording is kept rather than left empty for a note user.
  assert.equal(pa("לפי הרשומה, אין סף."), "לפי הרשומה, אין סף.");
});

test("the base chip is not repeated when the catalog already lists it", () => {
  const out = finalizeRolesV2(
    [pick("לוחם שריון")],
    [{ roleTitle: "לוחם שריון", basePercent: 70, closedBase: true, requirements: ["בסיס סגור", "פרופיל 72 ומעלה"] }],
  );
  assert.deepEqual(out[0].requirements, ["בסיס סגור", "פרופיל 72 ומעלה"]);
});

test("the pool brief marks elite tiers and the candidate's own clashes in Hebrew", () => {
  const prompt = buildSystemPromptV2([
    { roleTitle: "לוחם שייטת 13", tier: "elite", clashes: ["guard_duty_nights", "too_physical"] },
    { roleTitle: "תוכניתן/ית", tier: "regular", clashes: [] },
    { roleTitle: "טייס", tier: "elite", detailed: false },
  ]);
  assert.equal(prompt.match(/"tier":"elite"/g).length, 2, "one-liners carry the tier too");
  // What the role involves, not our questionnaire labels (those got pasted into cards verbatim).
  assert.ok(prompt.includes('"clashes":"שמירות ולילות, מאמץ גופני רב"'));
  assert.ok(!prompt.includes("פיזי מדי"));
  assert.equal(prompt.match(/"clashes":/g).length, 1);
  assert.ok(!prompt.includes("\u2014"));
  assert.ok(VERIFIED_FACTS_HE.includes('גולני וגבעתי (גדודים רגילים): אין סף דפ"ר ואין גיבוש או מיון'));
  assert.ok(VERIFIED_FACTS_HE.includes('"+ מילואים" פירושו מילואים אחרי השירות'));
});

test("fitness: unknown bands are left out and readiness is a feeling, not a measurement", () => {
  const prompt = (combatDetails) =>
    buildMatchUserPrompt({ ...base, assessmentSignals: { ...base.assessmentSignals, combatDetails } });
  const mixed = prompt({ run3kmBand: "unknown", pullUpsBand: "16_plus", pushUpsBand: "unknown", readiness: "ready" });
  assert.ok(mixed.includes("- כושר שנמדד (combatDetails): עליות מתח: 16 ומעלה\n"));
  assert.ok(mixed.includes("- מוכנות גופנית לפי תחושה, לא מדידה: מרגיש/ה מוכן/ה פיזית"));
  assert.ok(!mixed.includes("לא יודע/ת"));
  const none = prompt({ run3kmBand: "unknown", pullUpsBand: "unknown", pushUpsBand: "unknown", readiness: "unsure" });
  assert.ok(none.includes("(combatDetails): לא נמסר"));
});

test("the v2 prompt gives the model no words it should not echo", () => {
  const prompt = buildMatchUserPrompt({
    ...base,
    assessmentSignals: { ...base.assessmentSignals, rolesInterested: ["cyber", "medical"] },
  });
  for (const echoed of ["שורת הכושר", "ברשומה", "שדה base", "8200", "פרמדיק"]) {
    assert.ok(!prompt.includes(echoed), `no ${echoed}`);
  }
  assert.ok(prompt.includes("(rolesInterested): סייבר, רפואה"));
  assert.ok(!prompt.includes("- פנייה:"), "the voice line is for girls only");
  const girl = buildMatchUserPrompt({ ...base, profileForMatch: { ...base.profileForMatch, gender: "female" } });
  assert.ok(girl.includes("- מגדר: בת\n- פנייה: גם לבת כותבים ברבים, אתם/שלכם/תצטרכו; לעולם לא אתן/שלכן/מחפשות.\n- דפ\"ר"));
});

test("round 3: cards drop list talk, personalAnswer keeps it; spelling variants resolve; girls are not addressed as אתן", async () => {
  const { FEMININE_ADDRESS_RE } = await import("../controllers/aiController.js");
  const roles = [
    { roleTitle: "מגן/ת סייבר", description: "הקורס בבסמ\"ח. הוא פחות טכנולוגי מהאפשרויות האחרות ברשימה." },
    { roleTitle: "חובש/ת קרבי/ת", description: "אתם רוצים לעזור לאנשים." },
    { roleTitle: "תוכניתן/ית", description: "כתיבת קוד." },
    { roleTitle: "לוחם/ת ילת״ם", description: "חילוץ." },
    { roleTitle: "מש״ק/ית ת״ש", description: "רווחה." },
  ];
  const cards = finalizeRolesV2(roles, pool);
  assert.equal(cards[0].description, 'הקורס בבסמ"ח.');
  const answer = parsePersonalAnswer(JSON.stringify({ roles: [], personalAnswer: "התפקיד מגן/ת סייבר נמצא בחמישייה שלכם." }));
  assert.ok(answer.includes("בחמישייה"));

  const catalogish = [
    { roleTitle: "תכנית ארז", basePercent: 80 },
    { roleTitle: "מדריך/ה בחיל התקשוב", basePercent: 70 },
  ];
  assert.equal(countAiPicks([{ roleTitle: "תוכנית ארז" }, { roleTitle: "מדריך/ת חיל התקשוב" }], catalogish), 2);

  assert.ok(FEMININE_ADDRESS_RE.test("זה מתאים לכן ולמה שאתן מחפשות"));
  assert.ok(!FEMININE_ADDRESS_RE.test("אתם יכולים, וזה מתאים לכם. ניתן להתכונן"));
});

test("round 4: a Mixed office-avoider gets a concrete checklist; other candidates do not", () => {
  const prompt = (combatPreference, rolesAvoided, environment) =>
    buildMatchUserPrompt({
      ...base,
      preferences: { ...base.preferences, combatPreference, focus: "Research" },
      assessmentSignals: { ...base.assessmentSignals, rolesAvoided, environment },
    });
  const mixed = prompt("Mixed", ["office_only", "too_physical"], "field");
  const office = "לא נכנס לחמישייה בכלל, גם לא למקומות 4-5";
  assert.ok(mixed.includes("8. בדיקה לפני שליחה"));
  assert.ok(mixed.includes("תפקיד שטח לא קרבי"));
  assert.ok(mixed.includes(office));
  assert.ok(prompt("Mixed", [], "field").includes("לפחות תפקיד קרבי אחד"));
  assert.ok(!prompt("Mixed", ["office_only"], "office").includes(office), "chose an office environment");
  assert.ok(!prompt("TechTrack", [], "office").includes("8. בדיקה לפני שליחה"));
  // A cyber kid who ticked "avoid office" still wants the cyber tracks, which are desk work.
  assert.ok(!prompt("TechTrack", ["office_only"], "mixed").includes(office));
  assert.ok(!prompt("SupportHQ", ["office_only"], "field").includes(office));
  assert.ok(!mixed.includes("—"));
});

test("too physical without a combat interest: no combat role in any of the five", () => {
  const prompt = (combatPreference, rolesInterested) =>
    buildMatchUserPrompt({
      ...base,
      preferences: { ...base.preferences, combatPreference, focus: "Research" },
      assessmentSignals: { ...base.assessmentSignals, rolesAvoided: ["too_physical"], rolesInterested, environment: "mixed" },
    });
  assert.ok(prompt("Mixed", ["cyber", "medical"]).includes("ובלי תפקיד קרבי"));
  assert.ok(prompt("TechTrack", ["cyber"]).includes("אף תפקיד קרבי לא נכנס לחמישייה"));
  // Combat among the interests, or a combat direction, keeps combat roles open.
  assert.ok(!prompt("Mixed", ["combat", "medical"]).includes("ובלי תפקיד קרבי"));
  assert.ok(!prompt("FieldCombat", ["intelligence"]).includes("אף תפקיד קרבי"));
});

test("an officer wish adds a soft line that names no role", () => {
  const prompt = buildMatchUserPrompt({ ...base, personalRequest: "רוצה לצאת קצונה" });
  assert.ok(prompt.includes("שאיפה לקצונה או לפיקוד"));
  assert.ok(!buildMatchUserPrompt(base).includes("שאיפה לקצונה"));
  assert.ok(!/טייס|חובל|אדרים/.test(prompt.split("שאיפה לקצונה")[1].split("\n")[0]), "no hardcoded role");
});

test("round 5: the note's field roles are spelled out in the checklist", () => {
  const prompt = buildMatchUserPrompt({ ...base, noteTopicRoles: [["קצונה ייעודית מבצעית בחיל התקשוב", "מסלול אדרים"]] });
  assert.ok(prompt.includes("הבקשה האישית מבקשת קודם כל תחום שהתפקידים האלה עונים עליו: קצונה ייעודית מבצעית בחיל התקשוב | מסלול אדרים"));
  assert.ok(prompt.includes("לא נכנס למקום 1"), "a low-chance pick never leads");
  assert.ok(!buildMatchUserPrompt(base).includes("הבקשה האישית מבקשת"));
  assert.ok(!prompt.includes("—"));
});
