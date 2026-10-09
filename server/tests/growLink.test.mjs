import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaymentConfig, validatePaymentEnvironment } from "../services/payments/config.js";
import {
  normalizeGrowLinkWebhook,
  processGrowLinkWebhook,
  unflattenBracketKeys,
  israeliMobileDigits,
  verifyGrowLinkWebhookSecret,
} from "../services/payments/growLinkWebhook.js";
import { createClaimCode } from "../services/payments/paymentService.js";
import { validateCheckout } from "../validators/payments.js";

const SECRET = "a".repeat(40);

const linkEnv = {
  NODE_ENV: "production",
  PAYWALL_ENABLED: "true",
  PAYWALL_LAUNCH_AT: "2026-10-01T09:00:00.000Z",
  PAYMENTS_PROVIDER: "grow_link",
  GROW_PAYMENT_LINK_URL: "https://pay.grow.link/abc123",
  GROW_LINK_WEBHOOK_SECRET: SECRET,
  FRONTEND_URL: "https://app.example.test",
  API_PUBLIC_URL: "https://api.example.test",
  BUSINESS_LEGAL_NAME: "Example Operator",
  BUSINESS_PHONE: "+972-50-123-4567",
  BUSINESS_ADDRESS: "Configured address",
  BUSINESS_CONTACT_EMAIL: "support@example.test",
  CANCELLATION_URL: "https://app.example.test/cancellation",
  ISRAELI_LEGAL_REVIEW_CONFIRMED: "true",
};

const newSystemPayload = {
  err: "",
  status: "1",
  data: {
    statusCode: "2",
    status: "שולם",
    sum: "10",
    transactionId: "7654321",
    payerEmail: "Student@Example.test",
    dynamicFields: [{ label: "קוד הזמנה", field_value: " k7p2qx " }],
  },
};

test("grow_link production config needs no API credentials", () => {
  assert.deepEqual(validatePaymentEnvironment(linkEnv), []);
  const config = getPaymentConfig(linkEnv);
  assert.equal(config.provider, "grow_link");
  assert.equal(config.paymentLinkUrl, "https://pay.grow.link/abc123");
  assert.deepEqual(config.availableMethods, ["bit", "card"]);
});

test("grow_link rejects untrusted links and weak webhook secrets", () => {
  const errors = validatePaymentEnvironment({
    ...linkEnv,
    GROW_PAYMENT_LINK_URL: "https://evil.example/pay",
    GROW_LINK_WEBHOOK_SECRET: "short",
  }).join(" ");
  assert.match(errors, /GROW_PAYMENT_LINK_URL/);
  assert.match(errors, /GROW_LINK_WEBHOOK_SECRET/);
});

test("new-system webhook is normalized with claim code, amount and email", () => {
  const evidence = normalizeGrowLinkWebhook(newSystemPayload);
  assert.equal(evidence.paid, true);
  assert.equal(evidence.amountMinor, 1000);
  assert.equal(evidence.transactionId, "7654321");
  assert.equal(evidence.payerEmail, "student@example.test");
  assert.deepEqual(evidence.claimCodes, ["K7P2QX"]);
});

test("legacy flat webhook is treated as paid and reads purchaseCustomField", () => {
  const evidence = normalizeGrowLinkWebhook({
    webhookKey: "KEY123",
    transactionCode: "ABCD1234",
    paymentSum: 10,
    payerEmail: "a@b.test",
    purchaseCustomField: { code: "M3N4P5" },
  });
  assert.equal(evidence.paid, true);
  assert.equal(evidence.transactionId, "ABCD1234");
  assert.equal(evidence.webhookKey, "KEY123");
  assert.deepEqual(evidence.claimCodes, ["M3N4P5"]);
});

test("unpaid new-system webhook is not paid", () => {
  const evidence = normalizeGrowLinkWebhook({
    ...newSystemPayload,
    data: { ...newSystemPayload.data, statusCode: "1", status: "ממתין" },
  });
  assert.equal(evidence.paid, false);
});

test("webhook secret is required and compared exactly", async () => {
  assert.equal(verifyGrowLinkWebhookSecret(SECRET, linkEnv), true);
  assert.equal(verifyGrowLinkWebhookSecret(`${SECRET}x`, linkEnv), false);
  assert.equal(
    verifyGrowLinkWebhookSecret(SECRET, { ...linkEnv, GROW_LINK_WEBHOOK_SECRET: "" }),
    false,
  );
  await assert.rejects(
    processGrowLinkWebhook({ callbackSecret: "wrong", payload: newSystemPayload, env: linkEnv }),
    (error) =>
      error.status === 404 ||
      error.statusCode === 404 ||
      error.code === "PAYMENT_CALLBACK_NOT_FOUND",
  );
});

test("configured webhook key must match the payload", async () => {
  await assert.rejects(
    processGrowLinkWebhook({
      callbackSecret: SECRET,
      payload: { ...newSystemPayload, webhookKey: "WRONG" },
      env: { ...linkEnv, GROW_WEBHOOK_KEY: "RIGHTKEY" },
    }),
    (error) => error.code === "PAYMENT_CALLBACK_NOT_FOUND",
  );
});

test("wrong amount or unpaid status is acknowledged without unlocking", async () => {
  const wrongAmount = await processGrowLinkWebhook({
    callbackSecret: SECRET,
    payload: { ...newSystemPayload, data: { ...newSystemPayload.data, sum: "1" } },
    env: linkEnv,
  });
  assert.deepEqual(wrongAmount, { state: "ignored", reason: "amount_mismatch" });

  const unpaid = await processGrowLinkWebhook({
    callbackSecret: SECRET,
    payload: {
      ...newSystemPayload,
      data: { ...newSystemPayload.data, statusCode: "1", status: "" },
    },
    env: linkEnv,
  });
  assert.deepEqual(unpaid, { state: "ignored", reason: "not_paid" });
});

test("claim codes avoid ambiguous characters", () => {
  for (let index = 0; index < 200; index += 1) {
    assert.match(createClaimCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

test("checkout payload may omit payer details for hosted Grow pages", () => {
  const req = {
    body: {
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      confirmations: { termsAndCancellationAccepted: true, adultPayerConfirmed: true },
    },
  };
  assert.equal(validateCheckout(req).ok, true);
  assert.equal(req.body.payer, null);
});

test("Grow form posts with bracket keys are read (data[transactionId], data[customFields][cField1])", () => {
  const evidence = normalizeGrowLinkWebhook({
    status: "1",
    "data[statusCode]": "2",
    "data[transactionId]": "98765",
    "data[sum]": "10",
    "data[payerEmail]": "Parent@Example.com",
    "data[customFields][cField1]": "229dpj",
  });
  assert.equal(evidence.transactionId, "98765");
  assert.equal(evidence.paid, true);
  assert.equal(evidence.amountMinor, 1000);
  assert.equal(evidence.payerEmail, "parent@example.com");
  assert.deepEqual(evidence.claimCodes, ["229DPJ"]);
});

test("bracket keys cannot reach the prototype", () => {
  const out = unflattenBracketKeys({ "__proto__[polluted]": "x", "a[constructor][prototype][y]": "z", "b[c]": "1" });
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.y, undefined);
  assert.deepEqual(out, { b: { c: "1" } });
});

test("payer phone normalizes to the 9 local mobile digits", () => {
  assert.equal(israeliMobileDigits("050-123 4567"), "501234567");
  assert.equal(israeliMobileDigits("+972501234567"), "501234567");
  assert.equal(israeliMobileDigits("0501234567"), "501234567");
  assert.equal(israeliMobileDigits("031234567"), "");
  assert.equal(israeliMobileDigits(""), "");
  assert.equal(normalizeGrowLinkWebhook({ "data[payerPhone]": "0521112233" }).payerPhone, "521112233");
});
