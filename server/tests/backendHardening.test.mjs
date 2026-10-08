import { test } from "node:test";
import assert from "node:assert/strict";
import AiUsageLog from "../models/AiUsageLog.js";
import SystemConfig from "../models/SystemConfig.js";
import { canUseStandaloneAssessmentFallback } from "../controllers/assessmentsController.js";
import { buildMatchHistoryDeletionFilter } from "../controllers/matchHistoryController.js";
import { assertMatchingGrandfatherCutoff } from "../utils/grandfathering.js";
import { sanitizeSecurityPath } from "../utils/securityLog.js";

test("security event paths strip queries and redact every payment path secret", () => {
  const cases = [
    [
      "/api/payments/webhooks/grow/notify/order-123/callback-secret?token=query-secret",
      "/api/payments/webhooks/grow/notify/:order/:secret",
    ],
    [
      "/api/payments/webhooks/grow/invoice/order-123/callback-secret",
      "/api/payments/webhooks/grow/invoice/:order/:secret",
    ],
    [
      "/api/payments/return/order-123/return-secret?interrupted=1",
      "/api/payments/return/:order/:token",
    ],
    [
      "/api/payments/share/share-secret/checkout?another=secret",
      "/api/payments/share/:share/checkout",
    ],
    ["/api/health?token=never-store-this", "/api/health"],
  ];
  for (const [raw, expected] of cases) {
    const sanitized = sanitizeSecurityPath(raw);
    assert.equal(sanitized, expected);
    for (const secret of [
      "callback-secret",
      "return-secret",
      "share-secret",
      "query-secret",
      "never-store-this",
    ]) {
      assert.equal(sanitized.includes(secret), false);
    }
  }
});

test("history deletion targets every store copy for the authorized user and profile", () => {
  assert.deepEqual(
    buildMatchHistoryDeletionFilter("owner", "selected-id", "profile-hash"),
    { userId: "owner", profileHash: "profile-hash" },
  );
  assert.deepEqual(
    buildMatchHistoryDeletionFilter("owner", "selected-id", ""),
    { userId: "owner", _id: "selected-id" },
  );
});

test("assessment compatibility writes are forbidden in production", () => {
  assert.equal(canUseStandaloneAssessmentFallback({ NODE_ENV: "production" }), false);
  assert.equal(canUseStandaloneAssessmentFallback({ NODE_ENV: "development" }), true);
  assert.equal(canUseStandaloneAssessmentFallback({ NODE_ENV: "test" }), true);
});

test("AI persistence failures cannot consume the successful generation cap", () => {
  const statuses = AiUsageLog.schema.path("status").options.enum;
  assert.ok(statuses.includes("persistence_error"));
  assert.notEqual("persistence_error", "success");
});

test("paywall launch cutoff is durable and conflicts fail closed", () => {
  const indexes = SystemConfig.schema.indexes();
  assert.ok(
    indexes.some(([fields, options]) => fields.key === 1 && options.unique === true),
  );
  assert.equal(SystemConfig.schema.path("dateValue").options.immutable, true);
  assert.doesNotThrow(() =>
    assertMatchingGrandfatherCutoff(
      new Date("2026-10-01T09:00:00.000Z"),
      "2026-10-01T09:00:00.000Z",
    ),
  );
  assert.throws(
    () =>
      assertMatchingGrandfatherCutoff(
        new Date("2026-10-01T09:00:00.000Z"),
        new Date("2026-11-01T09:00:00.000Z"),
      ),
    (error) => error.code === "PAYWALL_LAUNCH_AT_CONFLICT",
  );
});
