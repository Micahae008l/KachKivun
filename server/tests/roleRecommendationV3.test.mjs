import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeRolesV3 } from "../utils/roleRecommendationV3.js";

const ranked = Array.from({ length: 5 }, (_, index) => ({
  roleTitle: `תפקיד ${index + 1}`,
  basePercent: 91 - index * 4,
  scoreBreakdown: {
    preference: 82.4 - index,
    focus: 76.6 - index,
    yom: 70.2 - index,
    eligibility: 64.8 - index,
    catalogQuality: 90,
    structuredAssessment: 73.5 - index,
  },
  category: "קטגוריה",
  combat: false,
  preferenceTags: ["data"],
  signals: [`אות ${index + 1}`],
  dayToDay: `יום בתפקיד ${index + 1}`,
  requirements: [],
  locations: [],
  serviceLengthLabel: "",
}));

test("v3 finalization preserves exact deterministic order and scores", () => {
  const aiRoles = [
    {
      roleTitle: "תפקיד 5",
      matchPercentage: 100,
      summary: "סיכום חמש",
      description: "הסבר חמש",
      tags: ["חמש"],
    },
    {
      roleTitle: "תפקיד 2",
      matchPercentage: 1,
      summary: "סיכום שתיים",
      description: "הסבר שתיים",
      tags: ["שתיים"],
    },
    {
      roleTitle: "תפקיד 1",
      matchPercentage: 2,
      summary: "סיכום אחת",
      description: "הסבר אחת",
      tags: ["תגית עוינת"],
      category: "קטגוריה עוינת",
      combat: true,
      requirements: ["דרישה עוינת"],
      dayToDay: "יומיום עוין",
      locations: ["מיקום עוין"],
      serviceLengthLabel: "שירות עוין",
      rank: 5,
      scoreBreakdown: { preference: 100 },
    },
    {
      roleTitle: "תפקיד 4",
      matchPercentage: 99,
      summary: "סיכום ארבע",
      description: "הסבר ארבע",
      tags: ["ארבע"],
    },
    {
      roleTitle: "שם שהומצא",
      matchPercentage: 100,
      summary: "אסור להשתמש",
      description: "סוד שגוי",
      tags: ["שגוי"],
    },
  ];

  const output = finalizeRolesV3(aiRoles, ranked, {
    daparScore: 80,
    medicalProfile: 82,
  });

  assert.deepEqual(
    output.map((role) => role.roleTitle),
    ranked.map((role) => role.roleTitle),
  );
  assert.deepEqual(
    output.map((role) => role.matchPercentage),
    ranked.map((role) => role.basePercent),
  );
  assert.deepEqual(
    output.map((role) => role.rank),
    [1, 2, 3, 4, 5],
  );
  assert.equal(output[1].description, "הסבר שתיים");
  assert.notEqual(output[2].description, "סוד שגוי");
  assert.ok(output[2].description.includes("דפ״ר 80"));
  assert.ok(output[2].nextStepPrompts.length > 0);
  assert.equal(output[0].category, ranked[0].category);
  assert.equal(output[0].combat, ranked[0].combat);
  assert.equal(output[0].dayToDay, ranked[0].dayToDay);
  assert.deepEqual(output[0].requirements, ranked[0].requirements);
  assert.deepEqual(output[0].locations, ranked[0].locations);
  assert.equal(output[0].serviceLengthLabel, ranked[0].serviceLengthLabel);
  assert.equal(output[0].tags.includes("תגית עוינת"), false);
  assert.deepEqual(output[0].scoreBreakdown, {
    preference: 82,
    focus: 77,
    yom: 70,
    eligibility: 65,
    catalogQuality: 90,
    structuredAssessment: 74,
  });
});

test("v3 title punctuation normalization recovers safe AI copy", () => {
  const output = finalizeRolesV3(
    [
      {
        roleTitle: "תפקיד-1",
        summary: "סיכום מנורמל",
        description: "הסבר מנורמל",
        tags: ["בדיקה"],
      },
    ],
    ranked,
  );
  assert.equal(output[0].roleTitle, "תפקיד 1");
  assert.equal(output[0].summary, "סיכום מנורמל");
});
