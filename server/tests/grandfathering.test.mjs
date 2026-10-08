import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrandfatherBulkOperation,
  buildGrandfatherEntitlementUpsert,
  GRANDFATHER_SOURCE,
  isGrandfatherEligible,
} from "../utils/grandfathering.js";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";

const cutoff = new Date("2026-10-01T09:00:00.000Z");
const oldCreatedAt = new Date("2026-09-30T23:59:59.999Z");

test("grandfather cutoff is strict and requires valid dates", () => {
  assert.equal(isGrandfatherEligible(oldCreatedAt, cutoff), true);
  assert.equal(isGrandfatherEligible(cutoff, cutoff), false);
  assert.equal(isGrandfatherEligible(new Date("2026-10-02"), cutoff), false);
  assert.equal(isGrandfatherEligible(null, cutoff), false);
  assert.equal(isGrandfatherEligible("not-a-date", cutoff), false);
  assert.equal(isGrandfatherEligible(oldCreatedAt, "not-a-cutoff"), false);
});

test("migration operation is deterministic, permanent, and preserves existing grants", () => {
  const input = {
    userId: "507f1f77bcf86cd799439011",
    userCreatedAt: oldCreatedAt,
    launchAt: cutoff,
  };
  const first = buildGrandfatherEntitlementUpsert(input);
  const second = buildGrandfatherEntitlementUpsert(input);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first.update), ["$set", "$setOnInsert"]);
  assert.deepEqual(first.update.$set, {
    grandfatheredAt: cutoff,
    grandfatherCutoffAt: cutoff,
  });
  assert.equal(first.update.$setOnInsert.status, "grandfathered");
  assert.equal(first.update.$setOnInsert.source, GRANDFATHER_SOURCE);
  assert.equal(first.update.$setOnInsert.expiresAt, null);
  assert.deepEqual(buildGrandfatherBulkOperation(input), {
    updateOne: {
      ...first,
      upsert: true,
    },
  });
});

test("access check auto-upserts a missed grandfather marker idempotently", async () => {
  let storedEntitlement = null;
  let upsertCalls = 0;
  let consistencyCalls = 0;
  const UserModel = {
    findById() {
      return {
        select() {
          return {
            async lean() {
              return {
                role: "user",
                createdAt: oldCreatedAt,
              };
            },
          };
        },
      };
    },
  };
  const EntitlementModel = {
    findOne() {
      return {
        sort() {
          return {
            async lean() {
              return storedEntitlement;
            },
          };
        },
      };
    },
    findOneAndUpdate(_filter, update) {
      upsertCalls += 1;
      storedEntitlement ||= {
        ...update.$setOnInsert,
        ...update.$set,
        updatedAt: new Date(),
      };
      return {
        async lean() {
          return storedEntitlement;
        },
      };
    },
  };

  const options = {
    paywallEnabled: true,
    launchAt: cutoff,
    now: new Date("2026-10-02T00:00:00.000Z"),
    UserModel,
    EntitlementModel,
    ensureCutoffConsistency: async () => {
      consistencyCalls += 1;
    },
  };
  const first = await getRecommendationAccessForUser("user-id", options);
  const second = await getRecommendationAccessForUser("user-id", options);
  assert.equal(first.topTwoUnlocked, true);
  assert.equal(second.topTwoUnlocked, true);
  assert.equal(upsertCalls, 1);
  assert.equal(consistencyCalls, 2);
  assert.equal(storedEntitlement.status, "grandfathered");
  assert.equal(storedEntitlement.expiresAt, null);
});
