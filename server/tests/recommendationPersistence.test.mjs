import { test } from "node:test";
import assert from "node:assert/strict";
import RoleRecommendation from "../models/RoleRecommendation.js";
import Entitlement from "../models/Entitlement.js";

const scoreBreakdown = {
  preference: 80,
  focus: 75,
  yom: 50,
  eligibility: 60,
  catalogQuality: 85,
  structuredAssessment: 70,
};

test("durable recommendation and entitlement schemas have no TTL indexes", () => {
  for (const model of [RoleRecommendation, Entitlement]) {
    const indexes = model.schema.indexes();
    assert.equal(
      indexes.some(([, options]) => options.expireAfterSeconds != null),
      false,
      `${model.modelName} must remain durable`,
    );
  }
});

test("recommendations are uniquely keyed by user and profile hash", () => {
  const uniqueIndex = RoleRecommendation.schema
    .indexes()
    .find(
      ([fields, options]) =>
        fields.userId === 1 && fields.profileHash === 1 && options.unique === true,
    );
  assert.ok(uniqueIndex);
});

test("durable recommendations require every rank from one through five", async () => {
  const roles = Array.from({ length: 4 }, (_, index) => ({
    rank: index + 1,
    roleTitle: `role-${index + 1}`,
    matchPercentage: 90 - index,
    scoreBreakdown,
  }));
  const doc = new RoleRecommendation({
    userId: "507f1f77bcf86cd799439011",
    profileHash: "profile-hash",
    profileSnapshot: {},
    engineVersion: "v3",
    scoringVersion: "scoring-v3",
    catalogVersion: "catalog-v3",
    promptVersion: "prompt-v3",
    roles,
  });
  await assert.rejects(
    doc.validate(),
    /recommendation must contain exactly one complete role for each rank 1-5/,
  );
});

test("durable role score breakdown uses only the documented numeric keys", async () => {
  const roles = Array.from({ length: 5 }, (_, index) => ({
    rank: index + 1,
    roleTitle: `role-${index + 1}`,
    matchPercentage: 90 - index,
    scoreBreakdown: {
      ...scoreBreakdown,
      internalPrompt: "must not persist",
      nestedInputs: { note: "must not persist" },
    },
  }));
  const doc = new RoleRecommendation({
    userId: "507f1f77bcf86cd799439011",
    profileHash: "profile-hash-with-breakdown",
    profileSnapshot: {},
    engineVersion: "v3",
    scoringVersion: "scoring-v3",
    catalogVersion: "catalog-v3",
    promptVersion: "prompt-v3",
    roles,
  });
  await doc.validate();

  assert.deepEqual(
    Object.keys(doc.roles[0].scoreBreakdown.toObject()),
    [
      "preference",
      "focus",
      "yom",
      "eligibility",
      "catalogQuality",
      "structuredAssessment",
    ],
  );
});
