import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import PaymentOrder, { PAYMENT_ORDER_STATUSES } from "../models/PaymentOrder.js";
import Entitlement from "../models/Entitlement.js";
import {
  GROW_BASE_URLS,
  choosePaymentMethod,
  getLifecyclePaymentConfig,
  getPaymentConfig,
  isPaywallEnabled,
  parsePaywallLaunchAt,
  resolveGrowPageCodes,
  validatePaymentEnvironment,
  validateLifecyclePaymentEnvironment,
} from "../services/payments/config.js";
import {
  AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  getPaymentProduct,
} from "../services/payments/catalog.js";
import { GrowProvider } from "../services/payments/growProvider.js";
import {
  createLifecyclePaymentProvider,
  createPaymentProvider,
} from "../services/payments/providerFactory.js";
import {
  paymentDisabledBody,
  requirePaymentsEnabled,
} from "../middleware/paymentsEnabled.js";
import {
  normalizeGrowAmountMinor,
  normalizeGrowCallback,
  normalizeGrowInvoiceCallback,
  normalizeGrowRefundResponse,
} from "../services/payments/growNormalization.js";
import {
  createOpaqueSecret,
  hashPaymentSecret,
  paymentSecretMatches,
} from "../services/payments/secrets.js";
import {
  parseIsraeliMobile,
  parsePayerFullName,
  validateCheckout,
  validateShareCheckout,
} from "../validators/payments.js";
import { productionEnvironmentErrors } from "../utils/requireEnv.js";
import paymentRoutes from "../routes/payments.js";
import paymentWebhookRoutes from "../routes/paymentWebhooks.js";

const validProductionEnv = {
  NODE_ENV: "production",
  PAYWALL_ENABLED: "true",
  PAYWALL_LAUNCH_AT: "2026-10-01T09:00:00.000Z",
  PAYMENTS_PROVIDER: "grow",
  GROW_ENV: "production",
  GROW_USER_ID: "merchant_123",
  GROW_API_KEY: "secret_123",
  GROW_PAGE_CODE_APPLE_PAY: "apple_123",
  GROW_PAGE_CODE_BIT: "bit_123",
  GROW_PAGE_CODE_GOOGLE_PAY: "google_123",
  GROW_PAGE_CODE_CARD: "card_123",
  FRONTEND_URL: "https://app.example.test",
  API_PUBLIC_URL: "https://api.example.test",
  BUSINESS_LEGAL_NAME: "Example Legal Operator",
  BUSINESS_PHONE: "+972-50-123-4567",
  BUSINESS_ADDRESS: "Configured address supplied by operator",
  BUSINESS_CONTACT_EMAIL: "support@example.test",
  CANCELLATION_URL: "https://app.example.test/cancellation",
  GROW_CALLBACK_AUTH_CONFIRMED: "true",
  GROW_DOMAIN_REVIEW_APPROVED: "true",
  ISRAELI_LEGAL_REVIEW_CONFIRMED: "true",
};

test("payment catalog locks the product to exactly 1000 agorot ILS", () => {
  const product = getPaymentProduct(AI_COUNSELOR_TOP_TWO_PRODUCT_KEY);
  assert.equal(product.amountMinor, 1000);
  assert.equal(product.currency, "ILS");
  assert.equal(product.permanent, true);
  assert.ok(Object.isFrozen(product));
});

test("production paywall rejects mock, sandbox, missing methods, and insecure origins", () => {
  assert.match(
    validatePaymentEnvironment({
      ...validProductionEnv,
      PAYMENTS_PROVIDER: "mock",
    }).join(" "),
    /mock is forbidden/i,
  );
  const errors = validatePaymentEnvironment({
    ...validProductionEnv,
    GROW_ENV: "sandbox",
    GROW_PAGE_CODE_APPLE_PAY: "",
    GROW_PAGE_CODE_BIT: "",
    GROW_PAGE_CODE_GOOGLE_PAY: "",
    GROW_PAGE_CODE_CARD: "",
    FRONTEND_URL: "http://app.example.test",
    API_PUBLIC_URL: "http://api.example.test",
  });
  assert.ok(errors.some((message) => /sandbox is forbidden/i.test(message)));
  assert.ok(errors.some((message) => /At least one Grow page code is required/.test(message)));
  assert.equal(errors.filter((message) => /must use HTTPS/.test(message)).length, 2);
  assert.deepEqual(validatePaymentEnvironment(validProductionEnv), []);
  assert.deepEqual(productionEnvironmentErrors(validProductionEnv), []);
});

test("disabled production starts without Grow credentials but forbids configured mock or sandbox", () => {
  const disabled = {
    NODE_ENV: "production",
    PAYWALL_ENABLED: "false",
  };
  assert.deepEqual(validatePaymentEnvironment(disabled), []);
  assert.deepEqual(productionEnvironmentErrors(disabled), []);
  assert.deepEqual(getPaymentConfig(disabled), {
    enabled: false,
    provider: "disabled",
    configuredProvider: "mock",
    availableMethods: [],
    merchant: {},
  });
  assert.match(
    validatePaymentEnvironment({ ...disabled, PAYMENTS_PROVIDER: "mock" }).join(" "),
    /mock is forbidden/i,
  );
  assert.match(
    validatePaymentEnvironment({
      ...disabled,
      PAYMENTS_PROVIDER: "grow",
      GROW_ENV: "sandbox",
    }).join(" "),
    /sandbox is forbidden/i,
  );
  assert.equal(isPaywallEnabled(undefined), false);
});

test("disabled charging retains fail-closed Grow lifecycle configuration", () => {
  const env = {
    NODE_ENV: "production",
    PAYWALL_ENABLED: "false",
    PAYMENTS_PROVIDER: "grow",
    GROW_ENV: "production",
    GROW_USER_ID: "merchant_123",
    GROW_API_KEY: "secret_123",
  };
  assert.deepEqual(validateLifecyclePaymentEnvironment(env, "grow"), []);
  const config = getLifecyclePaymentConfig(env, { provider: "grow" });
  assert.equal(config.enabled, false);
  assert.equal(config.lifecycleOnly, true);
  assert.equal(config.provider, "grow");
  assert.equal(config.baseUrl, GROW_BASE_URLS.production);
  assert.equal(
    createLifecyclePaymentProvider({
      config,
      fetchImpl: async () => assert.fail("test must not make a network call"),
    }) instanceof GrowProvider,
    true,
  );
  assert.throws(
    () =>
      getLifecyclePaymentConfig(
        { ...env, GROW_USER_ID: "" },
        { provider: "grow" },
      ),
    (error) => error.code === "PAYMENT_LIFECYCLE_CONFIG_INVALID",
  );
});

test("disabled payment middleware returns a stable 503 before provider construction", () => {
  const previous = process.env.PAYWALL_ENABLED;
  process.env.PAYWALL_ENABLED = "false";
  let nextCalled = false;
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  try {
    requirePaymentsEnabled({}, response, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, paymentDisabledBody());
    assert.throws(
      () =>
        createPaymentProvider({
          config: {
            enabled: false,
            provider: "disabled",
            availableMethods: [],
          },
        }),
      (error) => error.code === "PAYMENTS_DISABLED" && error.statusCode === 503,
    );
  } finally {
    if (previous === undefined) delete process.env.PAYWALL_ENABLED;
    else process.env.PAYWALL_ENABLED = previous;
  }
});

test("rollback gate blocks only new checkout creation routes", () => {
  function middlewareNames(router, path, method) {
    const layer = router.stack.find(
      (candidate) =>
        candidate.route?.path === path &&
        candidate.route?.methods?.[method] === true,
    );
    assert.ok(layer, `missing ${method.toUpperCase()} ${path}`);
    return layer.route.stack.map((handler) => handler.name);
  }

  for (const [path, method] of [
    ["/checkout", "post"],
    ["/parent-share", "post"],
    ["/share/:shareToken/checkout", "post"],
  ]) {
    assert.ok(
      middlewareNames(paymentRoutes, path, method).includes("requirePaymentsEnabled"),
    );
  }
  for (const [path, method] of [
    ["/offer", "get"],
    ["/share/:shareToken", "get"],
    ["/orders", "get"],
    ["/orders/:publicId", "get"],
    ["/return/:publicId/:returnToken", "get"],
    ["/orders/:publicId/cancel", "post"],
    ["/orders/:publicId/refund", "post"],
  ]) {
    assert.equal(
      middlewareNames(paymentRoutes, path, method).includes("requirePaymentsEnabled"),
      false,
    );
  }
  for (const path of [
    "/notify/:publicId/:callbackSecret",
    "/invoice/:publicId/:callbackSecret",
  ]) {
    assert.equal(
      middlewareNames(paymentWebhookRoutes, path, "post").includes(
        "requirePaymentsEnabled",
      ),
      false,
    );
  }
});

test("enabled production requires truthful merchant details, reviews, and ISO launch cutoff", () => {
  const errors = validatePaymentEnvironment({
    ...validProductionEnv,
    BUSINESS_PHONE: "",
    BUSINESS_ADDRESS: "",
    PAYWALL_LAUNCH_AT: "tomorrow",
    CANCELLATION_URL: "https://app.example.test/cancellation?token=secret",
    GROW_CALLBACK_AUTH_CONFIRMED: "false",
    GROW_DOMAIN_REVIEW_APPROVED: "",
    ISRAELI_LEGAL_REVIEW_CONFIRMED: "no",
  });
  for (const expected of [
    "BUSINESS_PHONE",
    "BUSINESS_ADDRESS",
    "PAYWALL_LAUNCH_AT",
    "CANCELLATION_URL",
    "GROW_CALLBACK_AUTH_CONFIRMED",
    "GROW_DOMAIN_REVIEW_APPROVED",
    "ISRAELI_LEGAL_REVIEW_CONFIRMED",
  ]) {
    assert.ok(errors.some((message) => message.includes(expected)), `missing ${expected} error`);
  }
  assert.equal(parsePaywallLaunchAt("2026-10-01"), null);
  assert.equal(parsePaywallLaunchAt("2026-02-30T09:00:00.000Z"), null);
  assert.equal(
    parsePaywallLaunchAt("2026-10-01T09:00:00.000Z")?.toISOString(),
    "2026-10-01T09:00:00.000Z",
  );
});

test("live Grow safety gates apply even when NODE_ENV is misconfigured", () => {
  const misconfigured = {
    ...validProductionEnv,
    NODE_ENV: "development",
    BUSINESS_PHONE: "",
    GROW_CALLBACK_AUTH_CONFIRMED: "false",
  };
  const errors = validatePaymentEnvironment(misconfigured);
  assert.ok(errors.some((message) => message.includes("BUSINESS_PHONE")));
  assert.ok(errors.some((message) => message.includes("GROW_CALLBACK_AUTH_CONFIRMED")));
  assert.ok(productionEnvironmentErrors(misconfigured).length >= 2);
});

test("Grow config hard-codes environment URLs and only legacy-falls back for card", () => {
  const pageCodes = resolveGrowPageCodes({
    GROW_PAGE_CODE: "legacy_card",
    GROW_PAGE_CODE_APPLE_PAY: "apple_code",
  });
  assert.equal(pageCodes.apple_pay, "apple_code");
  assert.equal(pageCodes.card, "legacy_card");
  assert.equal(pageCodes.bit, "");
  assert.equal(pageCodes.google_pay, "");

  const config = getPaymentConfig(validProductionEnv);
  assert.equal(config.baseUrl, GROW_BASE_URLS.production);
  assert.equal(choosePaymentMethod(config), "apple_pay");
  assert.equal(choosePaymentMethod(config, "bit"), "bit");
});

test("Grow amount normalization is exact and rejects fractional agorot", () => {
  assert.equal(normalizeGrowAmountMinor("10"), 1000);
  assert.equal(normalizeGrowAmountMinor("10.00"), 1000);
  assert.equal(normalizeGrowAmountMinor("10,5"), 1050);
  assert.equal(normalizeGrowAmountMinor(10.01), 1001);
  assert.equal(normalizeGrowAmountMinor("10.001"), null);
  assert.equal(normalizeGrowAmountMinor("₪10"), null);
  assert.equal(normalizeGrowAmountMinor(-1), null);
});

test("opaque payment secrets are random, hashed, and constant-time comparable", () => {
  const first = createOpaqueSecret();
  const second = createOpaqueSecret();
  assert.notEqual(first, second);
  assert.equal(first.length >= 32, true);
  const hash = hashPaymentSecret(first);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(paymentSecretMatches(first, hash), true);
  assert.equal(paymentSecretMatches(second, hash), false);
  assert.equal(paymentSecretMatches("", hash), false);
});

test("payer validator requires two words and normalizes Israeli mobile numbers", () => {
  assert.equal(parsePayerFullName("נועה כהן").ok, true);
  assert.equal(parsePayerFullName("נועה").ok, false);
  assert.deepEqual(parseIsraeliMobile("+972-50-123-4567"), {
    ok: true,
    value: "0501234567",
  });
  assert.equal(parseIsraeliMobile("03-1234567").ok, false);
});

test("checkout validator rejects client-controlled price and currency", () => {
  const validBody = {
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    idempotencyKey: crypto.randomUUID(),
    payer: {
      fullName: "נועה כהן",
      phone: "+972501234567",
    },
    paymentMethod: "apple_pay",
    confirmations: {
      termsAndCancellationAccepted: true,
      adultPayerConfirmed: true,
    },
  };
  const request = { body: structuredClone(validBody) };
  assert.deepEqual(validateCheckout(request), { ok: true });
  assert.equal(request.body.payer.phone, "0501234567");
  assert.deepEqual(request.body.confirmations, {
    termsAndCancellationAccepted: true,
    adultPayerConfirmed: true,
  });

  for (const forbidden of [
    { amountMinor: 1 },
    { currency: "USD" },
    { amount: 0 },
    { payer: { ...validBody.payer, email: "client@example.com" } },
  ]) {
    const invalid = { body: { ...structuredClone(validBody), ...forbidden } };
    const result = validateCheckout(invalid);
    assert.equal(result.ok, false);
    assert.match(result.error, /Unknown (?:body|payer) field/);
  }

  for (const key of [
    "termsAndCancellationAccepted",
    "adultPayerConfirmed",
  ]) {
    const invalid = {
      body: {
        ...structuredClone(validBody),
        confirmations: { ...validBody.confirmations, [key]: false },
      },
    };
    assert.equal(validateCheckout(invalid).ok, false);
  }
});

test("parent-share checkout requires the same adult and terms confirmations", () => {
  const request = {
    body: {
      payer: { fullName: "הורה משלם", phone: "0501234567" },
      paymentMethod: "bit",
      confirmations: {
        termsAndCancellationAccepted: true,
        adultPayerConfirmed: true,
      },
    },
  };
  assert.deepEqual(validateShareCheckout(request), { ok: true });
  assert.equal(
    validateShareCheckout({
      body: {
        ...structuredClone(request.body),
        confirmations: {
          termsAndCancellationAccepted: true,
          adultPayerConfirmed: false,
        },
      },
    }).ok,
    false,
  );
});

test("Grow callback normalizer handles nested provider shapes without retaining card data", () => {
  const normalized = normalizeGrowCallback({
    status: "1",
    err: "",
    data: {
      status: "שולם",
      statusCode: "2",
      processId: 456,
      processToken: "processToken12345678901234567890",
      transactionId: 789,
      transactionToken: "transactionToken123456789012345",
      transactionTypeId: "13",
      paymentType: "2",
      sum: "10.00",
      description: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
      customFields: {
        cField1: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
        cField2: "ILS",
      },
      cardToken: "must-not-be-retained",
    },
  });
  assert.equal(normalized.amountMinor, 1000);
  assert.equal(normalized.productKey, AI_COUNSELOR_TOP_TWO_PRODUCT_KEY);
  assert.equal(normalized.currency, "ILS");
  assert.equal("cardToken" in normalized, false);
  assert.equal("cardToken" in normalized.approvalFields, false);
});

test("Grow callback normalizer accepts URL-encoded and multipart bracket fields", () => {
  const normalized = normalizeGrowCallback({
    status: "1",
    "data[statusCode]": "2",
    "data[processId]": "456",
    "data[processToken]": "processToken12345678901234567890",
    "data[transactionId]": "789",
    "data[transactionToken]": "transactionToken123456789012345",
    "data[TransactionTypeId]": "13",
    "data[paymentType]": "2",
    "data[sum]": "10",
    "data[description]": AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    "data[customFields][cField1]": AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    "data[customFields][cField2]": "ILS",
  });
  assert.equal(normalized.processId, "456");
  assert.equal(normalized.transactionId, "789");
  assert.equal(normalized.statusCode, "2");
  assert.equal(normalized.amountMinor, 1000);
  assert.equal(normalized.currency, "ILS");
});

test("Grow refund is confirmed only by explicit refunded status", () => {
  assert.deepEqual(
    normalizeGrowRefundResponse({
      status: 1,
      err: "",
      data: {
        status: "תשלום שזוכה",
        statusCode: 3,
        refundedTransactionId: 333,
        transactionId: 789,
        sum: "10.00",
      },
    }),
    {
      state: "confirmed",
      statusCode: "3",
      statusText: "תשלום שזוכה",
      refundTransactionId: "333",
      transactionId: "789",
      amountMinor: 1000,
    },
  );
  assert.equal(normalizeGrowRefundResponse({ status: 1, err: "", data: {} }).state, "requested");
});

test("invoice callback accepts only trusted HTTPS receipt URLs", () => {
  assert.deepEqual(
    normalizeGrowInvoiceCallback({
      transactionCode: "789",
      invoiceNumber: "INV-10",
      invoiceUrl: "https://secure.meshulam.co.il/invoice/opaque",
    }),
    {
      transactionId: "789",
      invoiceNumber: "INV-10",
      invoiceUrl: "https://secure.meshulam.co.il/invoice/opaque",
    },
  );
  assert.throws(
    () =>
      normalizeGrowInvoiceCallback({
        transactionCode: "789",
        invoiceNumber: "INV-10",
        invoiceUrl: "https://evil.example/invoice",
      }),
    (error) => error.code === "GROW_INVOICE_INVALID",
  );
});

test("Grow adapter sends locked multipart fields through injected fetch only", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, fields: Object.fromEntries(options.body.entries()) };
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 1,
          err: "",
          data: {
            processId: "123",
            processToken: "processToken12345678901234567890",
            url: "https://secure.meshulam.co.il/far?l=opaque",
          },
        }),
    };
  };
  const config = { ...getPaymentConfig(validProductionEnv), timeoutMs: 1000 };
  const provider = new GrowProvider(config, { fetchImpl });
  await provider.createPaymentProcess({
    order: { publicId: crypto.randomUUID() },
    payer: {
      fullName: "נועה כהן",
      phone: "0501234567",
      email: "noa@example.com",
    },
    method: "apple_pay",
    product: getPaymentProduct(AI_COUNSELOR_TOP_TWO_PRODUCT_KEY),
    urls: {
      successUrl: "https://app.example.test/payment/return",
      cancelUrl: "https://app.example.test/payment/cancel",
      notifyUrl: "https://api.example.test/notify",
      invoiceNotifyUrl: "https://api.example.test/invoice",
    },
  });
  assert.equal(request.url, `${GROW_BASE_URLS.production}/createPaymentProcess`);
  assert.equal(request.options.method, "POST");
  assert.equal(request.fields.sum, "10.00");
  assert.equal(request.fields.pageCode, validProductionEnv.GROW_PAGE_CODE_APPLE_PAY);
  assert.equal(request.fields.cField1, AI_COUNSELOR_TOP_TWO_PRODUCT_KEY);
  assert.equal(request.fields.cField2, "ILS");
  assert.equal(request.fields.saveCardToken, "0");
  assert.equal(request.fields.apiKey, validProductionEnv.GROW_API_KEY);
});

test("payment schemas are durable and provider transaction IDs are unique", async () => {
  assert.deepEqual(
    new Set(PAYMENT_ORDER_STATUSES),
    new Set([
      "created",
      "pending",
      "processing",
      "paid",
      "failed",
      "refund_requested",
      "refunded",
      "expired",
    ]),
  );
  const indexes = PaymentOrder.schema.indexes();
  assert.ok(
    indexes.some(([fields, options]) => fields.growTransactionId === 1 && options.unique === true),
  );
  assert.ok(
    indexes.some(([fields, options]) => fields.openOrderKey === 1 && options.unique === true),
  );
  assert.equal(
    indexes.some(([, options]) => options.expireAfterSeconds != null),
    false,
  );
  for (const forbiddenPath of [
    "cardNumber",
    "cardToken",
    "cardExp",
    "cvv",
    "walletCredentials",
    "walletToken",
    "rawCallback",
    "rawProviderPayload",
  ]) {
    assert.equal(PaymentOrder.schema.path(forbiddenPath), undefined);
  }
  assert.equal(
    PaymentOrder.schema.path("termsAndCancellationAcceptedAt")?.instance,
    "Date",
  );
  assert.equal(PaymentOrder.schema.path("adultPayerConfirmedAt")?.instance, "Date");

  const legacyEntitlement = new Entitlement({
    userId: "507f1f77bcf86cd799439011",
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    source: "manual",
  });
  await legacyEntitlement.validate();
  assert.equal(legacyEntitlement.status, "active");
  assert.equal(legacyEntitlement.sourceOrderId, null);
});
