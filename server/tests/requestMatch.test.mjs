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
