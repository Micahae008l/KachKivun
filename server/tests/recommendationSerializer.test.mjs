import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerNamesLockedRole,
  serializeRecommendation,
  serializeRecommendationDetail,
  serializeRecommendationSummary,
} from "../utils/recommendationSerializer.js";
import { isPaywallEnabled, resolveRecommendationAccess } from "../utils/recommendationAccess.js";

function role(rank, marker) {
  return {
    rank,
    roleTitle: `כותרת-${marker}`,
    matchPercentage: 96 - rank,
    scoreBreakdown: {
      preference: 80 + rank,
      focus: 70 + rank,
      yom: 60 + rank,
      eligibility: 50 + rank,
      catalogQuality: 90,
      structuredAssessment: 75,
      hiddenInput: `פירוט-${marker}`,
    },
    summary: `תקציר-${marker}`,
    description: `תיאור-${marker}`,
    tags: [`תגית-${marker}`],
    nextStepPrompts: [`שאלה-${marker}`],
    category: `תחום-${marker} / קטגוריה-${marker}`,
    combat: rank === 1,
    dayToDay: `יומיום-${marker}`,
    requirements: [`דרישה-${marker}`],
    locations: [`מיקום-${marker}`],
    serviceLengthLabel: `שירות-${marker}`,
    admissionChance: { level: "medium", label: "סיכוי קבלה בינוני", reason: `נימוק-${marker}` },
  };
}

const recommendation = {
  _id: "recommendation-1",
  engineVersion: "v3",
  scoringVersion: "scoring-v3",
  catalogVersion: "catalog-v3",
  promptVersion: "prompt-v3",
  notice: "notice",
  createdAt: new Date("2026-09-18T10:00:00.000Z"),
  updatedAt: new Date("2026-09-18T10:00:00.000Z"),
  roles: [
    role(1, "LOCKED-ONE"),
    role(2, "LOCKED-TWO"),
    role(3, "LOCKED-THREE"),
    role(4, "VISIBLE-FOUR"),
    role(5, "VISIBLE-FIVE"),
  ],
};

const lockedAccess = {
  paywallEnabled: true,
  topTwoUnlocked: false,
  productKey: "ai_counselor_top_two",
};
const unlockedAccess = {
  ...lockedAccess,
  topTwoUnlocked: true,
};

test("recommendation paywall is enabled only by an explicit true value", () => {
  assert.equal(isPaywallEnabled(""), false);
  assert.equal(isPaywallEnabled("true"), true);
  assert.equal(isPaywallEnabled("unexpected"), false);
  assert.equal(isPaywallEnabled("false"), false);
});

test("locked serialization exposes only rank, percentage, broad field and chance level", () => {
  const serialized = serializeRecommendation(recommendation, lockedAccess);
  assert.deepEqual(Object.keys(serialized.roles[0]).sort(), [
    "admissionChance",
    "field",
    "kind",
    "locked",
    "matchPercentage",
    "rank",
  ]);
  assert.deepEqual(Object.keys(serialized.roles[1]).sort(), [
    "admissionChance",
    "field",
    "kind",
    "locked",
    "matchPercentage",
    "rank",
  ]);
  assert.deepEqual(Object.keys(serialized.roles[2]).sort(), [
    "admissionChance",
    "field",
    "kind",
    "locked",
    "matchPercentage",
    "rank",
  ]);
  assert.equal(serialized.roles[0].rank, 1);
  assert.equal(serialized.roles[0].matchPercentage, 95);
  assert.equal(serialized.roles[0].field, "תחום-LOCKED-ONE");
  assert.deepEqual(serialized.roles[0].admissionChance, {
    level: "medium",
    label: "סיכוי קבלה בינוני",
  });
  assert.equal("scoreBreakdown" in serialized.roles[0], false);
  assert.equal("scoreBreakdown" in serialized.roles[1], false);
  assert.equal("scoreBreakdown" in serialized.roles[2], false);
  assert.equal(serialized.roles[3].roleTitle, "כותרת-VISIBLE-FOUR");
  assert.deepEqual(serialized.roles[3].scoreBreakdown, {
    preference: 84,
    focus: 74,
    yom: 64,
    eligibility: 54,
    catalogQuality: 90,
    structuredAssessment: 75,
  });

  const json = JSON.stringify(serialized);
  for (const secret of [
    "כותרת-LOCKED-ONE",
    "תקציר-LOCKED-ONE",
    "תיאור-LOCKED-ONE",
    "תגית-LOCKED-ONE",
    "שאלה-LOCKED-ONE",
    "קטגוריה-LOCKED-ONE",
    "יומיום-LOCKED-ONE",
    "דרישה-LOCKED-ONE",
    "מיקום-LOCKED-ONE",
    "שירות-LOCKED-ONE",
    "פירוט-LOCKED-ONE",
    "נימוק-LOCKED-ONE",
    "כותרת-LOCKED-TWO",
    "כותרת-LOCKED-THREE",
    "תיאור-LOCKED-THREE",
  ]) {
    assert.equal(json.includes(secret), false, `locked payload leaked ${secret}`);
  }
});

test("history list and detail use the same locked serializer", () => {
  const summary = serializeRecommendationSummary(recommendation, lockedAccess);
  const detail = serializeRecommendationDetail(recommendation, lockedAccess);
  assert.equal(summary.topRole, "");
  assert.deepEqual(summary.roleTitles, ["כותרת-VISIBLE-FOUR", "כותרת-VISIBLE-FIVE"]);
  assert.equal(JSON.stringify(summary).includes("כותרת-LOCKED-THREE"), false);
  assert.equal(JSON.stringify(summary).includes("כותרת-LOCKED-ONE"), false);
  assert.equal(JSON.stringify(detail).includes("כותרת-LOCKED-TWO"), false);
});

test("disabled paywall and entitled access serialize all five complete roles", () => {
  for (const access of [{ paywallEnabled: false, topTwoUnlocked: false }, unlockedAccess]) {
    const serialized = serializeRecommendation(recommendation, access);
    assert.ok(serialized.roles.every((item) => item.kind === "role"));
    assert.deepEqual(
      serialized.roles.map((item) => item.roleTitle),
      recommendation.roles.map((item) => item.roleTitle),
    );
  }
});

test("access helper unlocks admins and active or grandfathered entitlements", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  assert.equal(
    resolveRecommendationAccess({ paywallEnabled: true, userRole: "user", now }).topTwoUnlocked,
    false,
  );
  assert.equal(
    resolveRecommendationAccess({ paywallEnabled: true, userRole: "admin", now }).topTwoUnlocked,
    true,
  );
  for (const status of ["active", "grandfathered"]) {
    assert.equal(
      resolveRecommendationAccess({
        paywallEnabled: true,
        userRole: "user",
        entitlement: { status, startsAt: new Date("2026-01-01"), expiresAt: null },
        now,
      }).topTwoUnlocked,
      true,
    );
  }
  assert.equal(
    resolveRecommendationAccess({
      paywallEnabled: true,
      userRole: "user",
      entitlement: {
        status: "active",
        startsAt: new Date("2026-01-01"),
        expiresAt: new Date("2026-09-18T11:59:59.000Z"),
      },
      now,
    }).topTwoUnlocked,
    false,
  );
  assert.equal(
    resolveRecommendationAccess({
      paywallEnabled: true,
      userRole: "user",
      entitlement: {
        status: "revoked",
        grandfatheredAt: new Date("2026-09-18T10:00:00.000Z"),
      },
      now,
    }).topTwoUnlocked,
    true,
  );
});

test("a personal answer that names a locked role is withheld until the unlock", () => {
  const withAnswer = (personalAnswer) => ({ ...recommendation, personalAnswer });
  const naming = withAnswer("כותרת-LOCKED-THREE הוא בדיוק מה שביקשתם.");
  const locked = serializeRecommendation(naming, lockedAccess);
  assert.equal(locked.personalAnswer, "");
  assert.equal(locked.personalAnswerLocked, true);
  assert.equal(JSON.stringify(locked).includes("כותרת-LOCKED-THREE"), false);

  const unlocked = serializeRecommendation(naming, unlockedAccess);
  assert.equal(unlocked.personalAnswerLocked, false);
  assert.match(unlocked.personalAnswer, /LOCKED-THREE/);

  const freeOnly = serializeRecommendation(
    withAnswer("כותרת-VISIBLE-FOUR עונה על הבקשה."),
    lockedAccess,
  );
  assert.equal(freeOnly.personalAnswerLocked, false);
  assert.match(freeOnly.personalAnswer, /VISIBLE-FOUR/);
});

test("gender slashes and parentheses do not hide a locked role name", () => {
  assert.equal(answerNamesLockedRole("תפקיד מפעיל רחפנים יתאים לכם", ["מפעיל/ת רחפנים"]), true);
  assert.equal(answerNamesLockedRole("מומלץ: תלפיות", ["תלפיות (כולל תואר)"]), true);
  assert.equal(answerNamesLockedRole("לוחם תותחנים", ["מפעיל/ת רחפנים"]), false);
});
