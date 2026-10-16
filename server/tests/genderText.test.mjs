import test from "node:test";
import assert from "node:assert/strict";
import { requirementsForGender, textForGender } from "../utils/genderText.js";
import { getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import { rolesForAi } from "../utils/roleScoring.js";

// [catalog string, for a man, for a woman]
const CASES = [
  ["32 חודשים (גם לנשים)", "32 חודשים", "32 חודשים (גם לנשים)"],
  ["32 חודשים (גם לנשים) + 3 שנות קבע", "32 חודשים + 3 שנות קבע", "32 חודשים (גם לנשים) + 3 שנות קבע"],
  ["נשים 32 חודשים", "", "נשים 32 חודשים"],
  ["כ-4 חודשי הכשרה במרכז; נשים 32 חודשים", "כ-4 חודשי הכשרה במרכז", "כ-4 חודשי הכשרה במרכז; נשים 32 חודשים"],
  ["נשים דרך מיון לוחמות", "", "נשים דרך מיון לוחמות"],
  ["מיון לוחמות", "", "מיון לוחמות"],
  ["גברים פרופיל 45-64, נשים 45 ומעלה", "גברים פרופיל 45-64", "נשים 45 ומעלה"],
  ["פרופיל עורפי לגברים", "פרופיל עורפי לגברים", ""],
  ["טירונות 02 + 3 חודשי קורס; גברים 32, נשים 24", "טירונות 02 + 3 חודשי קורס; גברים 32", "טירונות 02 + 3 חודשי קורס; נשים 24"],
  ["גברים פרופיל 82 (72 עם סעיף מתיר), נשים 82", "גברים פרופיל 82 (72 עם סעיף מתיר)", "נשים 82"],
  ["נשים במסלול ייעודי (קבוע מדצמבר 2025)", "", "נשים במסלול ייעודי (קבוע מדצמבר 2025)"],
  ["נשים וגברים בעלי פרופיל עורפי", "נשים וגברים בעלי פרופיל עורפי", "נשים וגברים בעלי פרופיל עורפי"],
  ["נשים: שירות כמו גברים", "", "נשים: שירות כמו גברים"],
  ["טר\"צ + קורס צבאי; שנת קבע; נשים כמו גברים", "טר\"צ + קורס צבאי; שנת קבע", "טר\"צ + קורס צבאי; שנת קבע; נשים כמו גברים"],
  ["טירונות 03 + קורס יחידתי; 4 חודשי קבע; נשים 16א", "טירונות 03 + קורס יחידתי; 4 חודשי קבע", "טירונות 03 + קורס יחידתי; 4 חודשי קבע; נשים 16א"],
  ["3 חודשי הכשרה; נשים 30 חודשים", "3 חודשי הכשרה", "3 חודשי הכשרה; נשים 30 חודשים"],
  ["שירות חובה מלא (דין אישה כדין גבר) + 24 חודשי קבע", "שירות חובה מלא (דין אישה כדין גבר) + 24 חודשי קבע", "שירות חובה מלא (דין אישה כדין גבר) + 24 חודשי קבע"],
  ["דפ\"ר 70 ומעלה, סיווג ביטחוני", "דפ\"ר 70 ומעלה, סיווג ביטחוני", "דפ\"ר 70 ומעלה, סיווג ביטחוני"],
];

test("each catalog clause goes only to the gender it is about", () => {
  for (const [text, male, female] of CASES) {
    assert.equal(textForGender(text, "male"), male, text);
    assert.equal(textForGender(text, "female"), female, text);
    assert.equal(textForGender(text, ""), text, "unknown gender is unchanged");
    assert.equal(textForGender(text, undefined), text);
  }
});

test("requirements drop entries that lose every clause, and pass through without a gender", () => {
  const list = ["פרופיל 82 ומעלה", "נשים דרך מיון לוחמות", "גברים פרופיל 45-64, נשים 45 ומעלה"];
  assert.deepEqual(requirementsForGender(list, "male"), ["פרופיל 82 ומעלה", "גברים פרופיל 45-64"]);
  assert.deepEqual(requirementsForGender(list, "female"), ["פרופיל 82 ומעלה", "נשים דרך מיון לוחמות", "נשים 45 ומעלה"]);
  assert.equal(requirementsForGender(list, null), list);
});

test("the AI pool never shows the other gender's catalog clauses", () => {
  const roles = getIdfRoleCatalogV3().roles;
  const base = { daparScore: 90, medicalProfile: 64, yomSource: "official", personalRequest: "" };
  const text = (r) => [r.serviceLengthLabel, ...r.requirements].join(" | ");
  for (const r of rolesForAi(roles, { ...base, gender: "male" })) {
    assert.ok(!/נשים(?! וגברים)|לוחמות/.test(text(r)) || /כדין/.test(text(r)), `${r.roleTitle}: ${text(r)}`);
  }
  for (const r of rolesForAi(roles, { ...base, gender: "female" })) {
    assert.ok(!/גברים/.test(text(r)) || /נשים וגברים|כמו גברים/.test(text(r)), `${r.roleTitle}: ${text(r)}`);
  }
});
