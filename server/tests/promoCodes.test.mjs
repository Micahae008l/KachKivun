import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePromoCode, normalizePromoCode, redeemPromoCode } from "../utils/promoCodes.js";

/** Just enough of Mongo's update semantics for the redeem query. */
function memoryModels({ promos = [], entitlements = [] } = {}) {
  const now = () => new Date("2026-10-22T10:00:00Z");
  const usable = (p, at) =>
    p.active &&
    (p.expiresAt == null || new Date(p.expiresAt) > at) &&
    (p.maxUses == null || p.usedCount < p.maxUses);
  const PromoModel = {
    findOneAndUpdate: async (filter) => {
      const p = promos.find(
        (x) => x.code === filter.code && usable(x, filter.$and[0].$or[1].expiresAt.$gt),
      );
      if (!p) return null;
      p.usedCount += 1;
      return p;
    },
    findOne: (filter) => ({ lean: async () => promos.find((x) => x.code === filter.code) ?? null }),
    updateOne: async (filter, update) => {
      const p = promos.find((x) => x._id === filter._id);
      p.usedCount += update.$inc.usedCount;
    },
  };
  const EntitlementModel = {
    findOne: (filter) => ({
      lean: async () => entitlements.find((e) => e.userId === filter.userId) ?? null,
    }),
    findOneAndUpdate: async (filter, update) => {
      let e = entitlements.find((x) => x.userId === filter.userId);
      if (!e) entitlements.push((e = { userId: filter.userId, productKey: filter.productKey }));
      Object.assign(e, update.$set);
      return e;
    },
  };
  return { PromoModel, EntitlementModel, promos, entitlements, now: now() };
}

test("normalizes codes and rejects junk", () => {
  assert.equal(normalizePromoCode(" kk-test 1 "), "KK-TEST1");
  assert.equal(normalizePromoCode("ab"), "");
  assert.equal(normalizePromoCode("קוד"), "");
  assert.match(generatePromoCode(), /^KK-[A-HJ-NP-Z2-9]{6}$/);
});

test("a valid code unlocks the user and takes one use", async () => {
  const m = memoryModels({
    promos: [{ _id: 1, code: "TEST", active: true, maxUses: 2, usedCount: 0, expiresAt: null }],
  });
  const result = await redeemPromoCode({ userId: "u1", rawCode: "test", ...m });
  assert.deepEqual(result, { status: "unlocked", code: "TEST" });
  assert.equal(m.promos[0].usedCount, 1);
  assert.equal(m.entitlements[0].status, "active");
  assert.equal(m.entitlements[0].source, "promo");
  assert.equal(m.entitlements[0].sourceTransactionId, "TEST");
});

test("an already unlocked user does not consume a use", async () => {
  const m = memoryModels({
    promos: [{ _id: 1, code: "TEST", active: true, maxUses: 1, usedCount: 0, expiresAt: null }],
    entitlements: [{ userId: "u1", status: "active" }],
  });
  const result = await redeemPromoCode({ userId: "u1", rawCode: "TEST", ...m });
  assert.equal(result.status, "already_unlocked");
  assert.equal(m.promos[0].usedCount, 0);
});

test("a used-up, expired or switched-off code is refused with its reason", async () => {
  const m = memoryModels({
    promos: [
      { _id: 1, code: "FULL", active: true, maxUses: 1, usedCount: 1, expiresAt: null },
      {
        _id: 2,
        code: "OLD",
        active: true,
        maxUses: null,
        usedCount: 0,
        expiresAt: "2026-10-01T00:00:00Z",
      },
      { _id: 3, code: "OFF", active: false, maxUses: null, usedCount: 0, expiresAt: null },
    ],
  });
  const codeOf = async (raw) =>
    redeemPromoCode({ userId: "u9", rawCode: raw, ...m }).then(
      () => "ok",
      (e) => e.code,
    );
  assert.equal(await codeOf("FULL"), "PROMO_USED_UP");
  assert.equal(await codeOf("OLD"), "PROMO_EXPIRED");
  assert.equal(await codeOf("OFF"), "PROMO_INVALID");
  assert.equal(await codeOf("NOPE"), "PROMO_INVALID");
  assert.equal(m.entitlements.length, 0);
});

test("a revoked unlock is reactivated by a new code", async () => {
  const m = memoryModels({
    promos: [{ _id: 1, code: "BACK", active: true, maxUses: null, usedCount: 0, expiresAt: null }],
    entitlements: [{ userId: "u1", status: "revoked", revokedReason: "refund" }],
  });
  await redeemPromoCode({ userId: "u1", rawCode: "BACK", ...m });
  assert.equal(m.entitlements[0].status, "active");
  assert.equal(m.entitlements[0].revokedReason, "");
});
