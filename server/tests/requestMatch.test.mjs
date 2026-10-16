import test from "node:test";
import assert from "node:assert/strict";
import { requestMatchedRoles, requestTerms } from "../utils/roleScoring.js";

const roles = [
  { roleTitle: "לוחם שריון", category: "לחימה", dayToDay: "תפעול טנק בשטח, עבודה קרבית בצוות." },
  { roleTitle: 'מטיס/ת חוץ כטמ"ם', category: 'אוויר / כטמ"ם', dayToDay: "הטסת כלי טיס בלתי מאוישים." },
  { roleTitle: "תוכניתן/ית", category: "טכנולוגיה", dayToDay: "פיתוח תוכנה במערכות צה״ל." },
];

test("drone request finds כטמ\"ם roles through synonyms, ahead of plain words", () => {
  const matched = requestMatchedRoles(roles, "אני ממש בקטע של רחפנים, משהו קרבי", 5);
  assert.equal(matched[0].roleTitle, 'מטיס/ת חוץ כטמ"ם');
  assert.ok(matched.some((r) => r.roleTitle === "לוחם שריון"), "plain word קרבי still matches, after");
});

test("stopwords alone match nothing", () => {
  assert.deepEqual(requestMatchedRoles(roles, "אני רוצה תפקיד מעניין בשירות"), []);
  assert.deepEqual(requestTerms("").group, []);
});

test("one-letter Hebrew prefix still matches (הרחפנים)", () => {
  assert.ok(requestTerms("על הרחפנים").group.includes("כטמ"));
});

test("combat profile lowers the chance for tech roles; dapar margin raises it", async () => {
  const { admissionChance } = await import("../utils/roleScoring.js");
  const tech = { roleTitle: "תוכניתן/ית", category: "תקשוב / תוכנה", combat: false, competitiveness: "high", daparFloor: 70 };
  const male97 = { gender: "male", medicalProfile: 97, daparScore: 80 };
  const female97 = { gender: "female", medicalProfile: 97, daparScore: 80 };
  assert.equal(admissionChance(tech, male97).level, "low");
  assert.equal(admissionChance(tech, female97).level, "medium");
  const easy = { roleTitle: "x", category: "לוגיסטיקה", combat: false, competitiveness: "medium", daparFloor: 40 };
  assert.equal(admissionChance(easy, female97).level, "high");
  assert.equal(admissionChance(easy, { gender: "male" }).level, "unknown");
});

test("rolesForAi keeps every eligible role and puts request matches first", async () => {
  const { rolesForAi, scoreRole } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const roles = getIdfRoleCatalogV3().roles;
  const profile = { daparScore: 50, medicalProfile: 64, gender: "female", personalRequest: "רחפנים" };
  const list = rolesForAi(roles, profile);
  const eligible = roles.filter((r) => scoreRole(r, { ...profile, yomFlat: true }).eligible).length;
  assert.equal(list.length, eligible);
  assert.ok(list[0].requestMatch, "first entry answers the request");
  assert.ok(list.every((r, i) => !r.requestMatch || list.slice(0, i).every((p) => p.requestMatch)), "matches form a prefix");
});

test("real-note matcher cases against the catalog", async () => {
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const titles = (note, limit = 40) => requestMatchedRoles(catalog, note, limit).map((r) => r.roleTitle);

  // Filler "חשוב לי" used to hit מחשוב (IT roles, שב"כ) by stripping the מ.
  assert.deepEqual(titles("חשוב לי"), []);
  assert.deepEqual(titles("אני רוצה תפקיד בשירות"), []);
  // Request-side prefixes: "לסיירת", "בדובר".
  assert.deepEqual(titles("לסיירת גולני", 2).sort(), ["לוחם בגולני", "לוחם בסיירת חטיבתית"].sort());
  const dover = titles("בדובר צהל");
  assert.ok(dover.includes('מש"ק/ית דוברות'));
  assert.ok(!dover.some((t) => t.includes("לדוברי השפה")), "דובר is not דוברי השפה");
  // Numbers and gendered forms.
  assert.deepEqual(titles("669"), ["לוחם 669"]);
  assert.ok(titles("לוחמת", 5).every((t) => t.startsWith("לוחם")));
  // Synonym groups.
  assert.ok(titles("קולנוע", 5).every((t) => /וידאו|צלם|הסרטה/.test(t)));
  assert.ok(titles("חיל הים", 5).length === 5);
  assert.deepEqual(requestTerms("הרבה ימי חופש").group, [], "ימי חופש is not the navy");
});

test("negation keeps a rejected field out of the request", () => {
  const terms = requestTerms("אני לא במגמת מחשבים אני בביולוגיה");
  assert.ok(terms.group.includes("ביולוג"));
  assert.ok(!terms.raw.some((t) => t.includes("מחשב")));
  assert.deepEqual(requestTerms("לא סייבר").topics, []);
  assert.deepEqual(requestTerms("לא הורג כמו קרבי").topics, []);
  // A new clause ends the negation.
  assert.ok(requestTerms("לא קרבי, אבל סייבר").group.includes("סייבר"));
  assert.ok(requestTerms("לא קרבי אבל סייבר").group.includes("סייבר"));
});

test("a broad topic cannot crowd the others out of the request slots", async () => {
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const matched = requestMatchedRoles(getIdfRoleCatalogV3().roles, "מודיעין או גבולות", 5);
  assert.ok(matched.some((r) => r.roleTitle.includes("גבולות")));
  assert.ok(matched.some((r) => /מודיעין/.test(`${r.roleTitle} ${r.category}`)));
});

test("requestedButBlocked explains requested roles the gates closed", async () => {
  const { requestedButBlocked } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const female = { gender: "female", daparScore: 70, medicalProfile: 97, personalRequest: "עוקץ/669" };
  const blocked = requestedButBlocked(catalog, female);
  assert.deepEqual(blocked.map((b) => b.roleTitle).sort(), ["לוחם 669", "לוחם עוקץ"].sort());
  assert.ok(blocked.every((b) => b.reasons.includes("התפקיד אינו פתוח למגדר הנבחר")));
  assert.deepEqual(requestedButBlocked(catalog, { ...female, gender: "male" }), [], "open roles are not blocked");
  assert.deepEqual(requestedButBlocked(catalog, { ...female, personalRequest: "" }), []);
  assert.deepEqual(requestedButBlocked(catalog, { ...female, personalRequest: "לא עוקץ" }), [], "negated");
  assert.deepEqual(requestedButBlocked(catalog, { ...female, personalRequest: "ktktk" }), [], "junk");
  // Real notes: a named role is explained, a field word ("לוחמה", "לוחמת", "מודיעין") is not.
  const medic = requestedButBlocked(catalog, { ...female, daparScore: 50, personalRequest: "שואפת לפרמדיקית אבל הדפר 50" });
  assert.deepEqual(medic.map((b) => b.roleTitle), ["פרמדיק/ית"]);
  const unknownDapar = { ...female, daparScore: "unknown", personalRequest: "שואפת לפרמדיקית" };
  assert.deepEqual(requestedButBlocked(catalog, unknownDapar), [], "an unknown score never closes a role");
  const male40 = { gender: "male", daparScore: 40, medicalProfile: 82, personalRequest: "רוצה לוחמה בקצב גבוה לפעול הרבה" };
  assert.deepEqual(requestedButBlocked(catalog, male40), []);
  assert.deepEqual(requestedButBlocked(catalog, { ...female, daparScore: 30, personalRequest: "רוצה להיות לוחמת בשטח, מודיעין" }), []);
});

test("'אם לא X' and 'לא משנה לי X' still ask for X", () => {
  const ifNot = requestTerms("אם לא טיס אז חובש קרבי");
  assert.ok(ifNot.group.includes("טיס") && ifNot.group.includes("חובש"));
  assert.ok(requestTerms('לא משנה לי טייס או שב"כ').group.includes("טייס"));
  assert.ok(requestTerms("לא רק סייבר").group.includes("סייבר"));
});

test("a stray note word does not lead the request list", () => {
  // Roles come best first. "למערכת" reaches "מערך" only by the suffix rule; "אוכל" is not "אוכלוסייה".
  const ranked = [
    { roleTitle: "לוחם קרבי", category: "לחימה" },
    { roleTitle: "מערך גוררות", category: "ים" },
  ];
  assert.equal(requestMatchedRoles(ranked, "למערכת קרבית")[0].roleTitle, "לוחם קרבי");
  const topicFirst = [
    { roleTitle: "רכז/ת אוכלוסייה", category: "פיקוד העורף" },
    { roleTitle: "מסלול גאמא", category: "מודיעין" },
  ];
  assert.equal(requestMatchedRoles(topicFirst, "אוכל לעשות מודיעין")[0].roleTitle, "מסלול גאמא");
});

test("prefix stripping does not turn כימית into ימית or הכשרות into כשרות", async () => {
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const titles = (note) => requestMatchedRoles(catalog, note, 40).map((r) => r.roleTitle);
  assert.ok(!titles("רוצה חיל הים").includes("עובד/ת מעבדה כימית"));
  const religious = titles("אני דתי");
  assert.ok(religious.length > 0 && !religious.some((t) => t === "מדריך/ת חי״ר" || t === "לוחם בגבעתי"));
});

test("requestedButBlocked catches short asks and skips generic title words", async () => {
  const { requestedButBlocked } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const male = { gender: "male", daparScore: 60, medicalProfile: 82 };
  const blocked = (note) => requestedButBlocked(catalog, { ...male, personalRequest: note }).map((b) => b.roleTitle);
  assert.ok(blocked("רוצה טיס").includes("טייס"));
  assert.ok(!blocked("רוצה קורס טיס").includes('קורס מת"ן'), "קורס names no role");
  assert.ok(blocked('רוצה שב"כ').length === 0, "open at דפ\"ר 60");
  assert.ok(requestedButBlocked(catalog, { ...male, daparScore: 30, personalRequest: 'רוצה שב"כ' }).some((b) => b.roleTitle.includes("שב")));
});

test("requestedButBlocked lists the whole דובר צה\"ל family for a profile-97 boy, and says why", async () => {
  const { requestedButBlocked } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const boy = { gender: "male", daparScore: 60, medicalProfile: 97, personalRequest: "אני מאוד אוהב עיתונאות והייתי שמח להיות בדובר צהל" };
  const blocked = requestedButBlocked(catalog, boy);
  for (const title of ['צלם/ת ביחידת דובר צה"ל', "כתב/ת צבאי/ת", 'מש"ק/ית דוברות']) {
    assert.deepEqual(blocked.find((b) => b.roleTitle === title)?.reasons, ["פתוח לגברים רק עד פרופיל 82, ובפרופיל 97 מיועדים ללוחמה"], title);
  }
  assert.deepEqual(requestedButBlocked(catalog, { ...boy, medicalProfile: 82 }), [], "open at 82");
  // A broad group still names no particular role: "מודיעין" hits dozens of titles.
  assert.deepEqual(requestedButBlocked(catalog, { ...boy, daparScore: 10, personalRequest: "מודיעין" }), []);
});

test("'המערך הטכני של חיל האוויר' leads with the air force technicians, not every air force role", async () => {
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const catalog = getIdfRoleCatalogV3().roles;
  const matched = requestMatchedRoles(catalog, "אני מחפש תפקיד במערך הטכני של חיל האוויר", 40);
  const firstSix = matched.slice(0, 6);
  assert.ok(firstSix.every((r) => /טכני/.test(r.category) && /אוויר/.test(`${r.category} ${r.roleTitle}`)), firstSix.map((r) => r.roleTitle).join(", "));
  // The new group alone does not flood: a plain note without the word asks for none of it.
  assert.ok(!requestTerms("אני רוצה להיות בחיל האוויר").group.includes("טכנאי"));
});

test("rolesForAi marks the candidate's own avoidances each role hits", async () => {
  const { rolesForAi } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const roles = getIdfRoleCatalogV3().roles;
  const profile = { daparScore: 60, medicalProfile: 64, gender: "female", assessmentSignals: { rolesAvoided: ["office_only", "far_from_home"] } };
  const list = rolesForAi(roles, profile);
  assert.ok(list.some((r) => r.clashes.includes("office_only")));
  assert.ok(list.every((r) => r.clashes.every((k) => (r.avoidanceSignals || []).includes(k) && profile.assessmentSignals.rolesAvoided.includes(k))));
  assert.ok(rolesForAi(roles, { ...profile, assessmentSignals: {} }).every((r) => r.clashes.length === 0));
});

test("a note that names a field lists the open roles that answer it; a religious-environment wish does not", async () => {
  const { rolesForAi, requestTopicRoles } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const roles = getIdfRoleCatalogV3().roles;
  const profile = { daparScore: 60, medicalProfile: 97, gender: "male", combatPreference: "TechTrack" };
  const note = "תפקיד קצונה זה חשוב לי";
  const topics = requestTopicRoles(rolesForAi(roles, { ...profile, personalRequest: note }), note);
  assert.ok(topics.length >= 1);
  assert.ok(topics.flat().some((t) => /קצונה|קצין|ארז|אדרים/.test(t)), topics.flat().join(", "));
  const religious = "חשוב לי שיהיו עוד אנשים דתיים סביבי";
  assert.deepEqual(requestTopicRoles(rolesForAi(roles, { ...profile, personalRequest: religious }), religious), []);
  assert.deepEqual(requestTopicRoles(rolesForAi(roles, profile), ""), []);
});

test("note topics come in the order the note names them", async () => {
  const { rolesForAi, requestTopicRoles } = await import("../utils/roleScoring.js");
  const { getIdfRoleCatalogV3 } = await import("../utils/roleCatalogV3.js");
  const roles = getIdfRoleCatalogV3().roles;
  const profile = { daparScore: 70, medicalProfile: 97, gender: "female", combatPreference: "Mixed" };
  const note = "אני רוצה חיל הים. וגם מודיעין";
  const [first] = requestTopicRoles(rolesForAi(roles, { ...profile, personalRequest: note }), note);
  assert.ok(first.some((t) => /ימי|סטי|ילת/.test(t)), first.join(", "));
});
