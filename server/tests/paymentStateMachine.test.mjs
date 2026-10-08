import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import { PaymentError } from "../services/payments/errors.js";
import {
  buildEntitlementGrantOperation,
  buildEntitlementRefundOperation,
} from "../services/payments/paymentPersistence.js";
import {
  cancellationActionForStatus,
  classifyInvoiceReceipt,
  isDefinitiveFailedCreate,
  payerPurgeFields,
  paymentOpenOrderKey,
  refundOutcomeMayExist,
} from "../services/payments/orderState.js";
import {
  buildParentShareSummary,
  CANCELLATION_ORDER_STATUSES,
  confirmMockPayment,
  getPublicPaymentOffer,
  reconcileOrder,
  serializePaymentOrder,
} from "../services/payments/paymentService.js";
import {
  verifyApproveAndGrantGrowPayment,
  verifyGrowPaymentEvidence,
} from "../services/payments/paymentStateMachine.js";
import { hashPaymentSecret } from "../services/payments/secrets.js";

const PROCESS_TOKEN = "processToken12345678901234567890";
const TRANSACTION_TOKEN = "transactionToken123456789012345";

function makeOrder(overrides = {}) {
  return {
    _id: "order-db-id",
    publicId: "104975b1-3c25-45f8-aa20-a980467b82ad",
    userId: "user-db-id",
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    amountMinor: 1000,
    currency: "ILS",
    status: "pending",
    provider: "grow",
    chosenMethod: "apple_pay",
    growPageCode: "apple-page-code",
    growProcessId: "456",
    growProcessToken: PROCESS_TOKEN,
    growProcessTokenHash: hashPaymentSecret(PROCESS_TOKEN),
    growTransactionId: null,
    providerTransactionId: null,
    createdAt: new Date("2026-09-18T10:00:00.000Z"),
    updatedAt: new Date("2026-09-18T10:00:00.000Z"),
    ...overrides,
  };
}

function makeEvidence(overrides = {}) {
  return {
    processId: "456",
    processToken: PROCESS_TOKEN,
    transactionId: "789",
    transactionToken: TRANSACTION_TOKEN,
    transactionTypeId: "13",
    paymentType: "2",
    amountMinor: 1000,
    amountMajor: "10.00",
    statusCode: "2",
    statusText: "שולם",
    productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
    currency: "ILS",
    approvalFields: {
      processId: "456",
      processToken: PROCESS_TOKEN,
      transactionId: "789",
      transactionToken: TRANSACTION_TOKEN,
      transactionTypeId: "13",
      paymentType: "2",
      sum: "10.00",
    },
    ...overrides,
  };
}

function callbackPayload(overrides = {}) {
  const evidence = makeEvidence(overrides);
  return {
    status: "1",
    err: "",
    data: {
      processId: evidence.processId,
      processToken: evidence.processToken,
      transactionId: evidence.transactionId,
      transactionToken: evidence.transactionToken,
      transactionTypeId: evidence.transactionTypeId,
      paymentType: evidence.paymentType,
      sum: (evidence.amountMinor / 100).toFixed(2),
      statusCode: evidence.statusCode,
      status: evidence.statusText,
      description: evidence.productKey,
      customFields: {
        cField1: evidence.productKey,
        cField2: evidence.currency,
      },
    },
  };
}

function fakes({ evidence = makeEvidence(), owner = null } = {}) {
  const calls = { inquiry: 0, approve: 0, finalize: 0 };
  const provider = {
    async getPaymentProcessInfo() {
      calls.inquiry += 1;
      return evidence;
    },
    async approveTransaction() {
      calls.approve += 1;
      return { confirmed: true };
    },
  };
  const persistence = {
    async findTransactionOwner() {
      return owner;
    },
    async finalizePaid({ evidence: verified }) {
      calls.finalize += 1;
      return {
        status: "paid",
        duplicate: false,
        order: {
          ...makeOrder(),
          status: "paid",
          providerTransactionId: verified.transactionId,
        },
      };
    },
  };
  return { calls, provider, persistence };
}

test("verified callback inquiry approves once and grants permanent access", async () => {
  const { calls, provider, persistence } = fakes();
  const result = await verifyApproveAndGrantGrowPayment({
    order: makeOrder(),
    callbackPayload: callbackPayload(),
    provider,
    persistence,
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
  assert.equal(result.state, "paid");
  assert.deepEqual(calls, { inquiry: 1, approve: 1, finalize: 1 });
});

test("paid and refunded callback replays are harmless and do no provider work", async () => {
  for (const status of ["paid", "refund_requested", "refunded"]) {
    const { calls, provider, persistence } = fakes();
    const result = await verifyApproveAndGrantGrowPayment({
      order: makeOrder({
        status,
        providerTransactionId: "789",
        growTransactionId: "789",
      }),
      callbackPayload: callbackPayload(),
      provider,
      persistence,
    });
    assert.equal(result.duplicate, true);
    assert.deepEqual(calls, { inquiry: 0, approve: 0, finalize: 0 });
  }
});

test("wrong callback amount fails before provider inquiry", async () => {
  const { calls, provider, persistence } = fakes();
  await assert.rejects(
    verifyApproveAndGrantGrowPayment({
      order: makeOrder(),
      callbackPayload: callbackPayload({ amountMinor: 999 }),
      provider,
      persistence,
    }),
    (error) => error.code === "PAYMENT_AMOUNT_MISMATCH",
  );
  assert.deepEqual(calls, { inquiry: 0, approve: 0, finalize: 0 });
});

test("payment evidence is checked against the immutable order snapshot", () => {
  const historicalOrder = makeOrder({ amountMinor: 900, currency: "ILS" });
  const historicalEvidence = makeEvidence({ amountMinor: 900 });
  assert.equal(verifyGrowPaymentEvidence(historicalOrder, historicalEvidence), historicalEvidence);
});

test("wrong callback process token fails before provider inquiry", async () => {
  const { calls, provider, persistence } = fakes();
  await assert.rejects(
    verifyApproveAndGrantGrowPayment({
      order: makeOrder(),
      callbackPayload: callbackPayload({
        processToken: "wrongProcessToken123456789012345678",
      }),
      provider,
      persistence,
    }),
    (error) => error.code === "PAYMENT_PROCESS_TOKEN_MISMATCH",
  );
  assert.deepEqual(calls, { inquiry: 0, approve: 0, finalize: 0 });
});

test("inquiry mismatch and inquiry failure both fail closed", async () => {
  {
    const { calls, provider, persistence } = fakes({
      evidence: makeEvidence({ amountMinor: 1 }),
    });
    await assert.rejects(
      verifyApproveAndGrantGrowPayment({
        order: makeOrder(),
        callbackPayload: callbackPayload(),
        provider,
        persistence,
      }),
      (error) => error.code === "PAYMENT_AMOUNT_MISMATCH",
    );
    assert.deepEqual(calls, { inquiry: 1, approve: 0, finalize: 0 });
  }
  {
    const expected = new PaymentError("GROW_TIMEOUT", undefined, 502, {
      retryable: true,
    });
    const provider = {
      async getPaymentProcessInfo() {
        throw expected;
      },
    };
    const persistence = {
      async findTransactionOwner() {
        assert.fail("persistence must not run after inquiry failure");
      },
    };
    await assert.rejects(
      verifyApproveAndGrantGrowPayment({
        order: makeOrder(),
        callbackPayload: callbackPayload(),
        provider,
        persistence,
      }),
      (error) => error === expected,
    );
  }
});

test("callback and inquiry transaction tokens must identify the same transaction", async () => {
  const { calls, provider, persistence } = fakes({
    evidence: makeEvidence({
      transactionToken: "differentTransactionToken1234567890",
    }),
  });
  await assert.rejects(
    verifyApproveAndGrantGrowPayment({
      order: makeOrder(),
      callbackPayload: callbackPayload(),
      provider,
      persistence,
    }),
    (error) => error.code === "PAYMENT_TRANSACTION_TOKEN_MISMATCH",
  );
  assert.deepEqual(calls, { inquiry: 1, approve: 0, finalize: 0 });
});

test("out-of-order unpaid callback does not query, approve, or grant", async () => {
  const { calls, provider, persistence } = fakes();
  await assert.rejects(
    verifyApproveAndGrantGrowPayment({
      order: makeOrder(),
      callbackPayload: callbackPayload({ statusCode: "11", statusText: "pending" }),
      provider,
      persistence,
    }),
    (error) => error.code === "PAYMENT_NOT_CONFIRMED",
  );
  assert.deepEqual(calls, { inquiry: 0, approve: 0, finalize: 0 });
});

test("duplicate provider transaction is rejected before approval", async () => {
  const { calls, provider, persistence } = fakes({
    owner: { _id: "another-order" },
  });
  await assert.rejects(
    verifyApproveAndGrantGrowPayment({
      order: makeOrder(),
      callbackPayload: callbackPayload(),
      provider,
      persistence,
    }),
    (error) => error.code === "PAYMENT_TRANSACTION_DUPLICATE",
  );
  assert.deepEqual(calls, { inquiry: 1, approve: 0, finalize: 0 });
});

test("pending status safely reconciles through inquiry and approval", async () => {
  const { calls, provider, persistence } = fakes();
  const result = await reconcileOrder(makeOrder(), { provider, persistence });
  assert.equal(result.reconciliation, "paid");
  assert.equal(result.order.status, "paid");
  assert.deepEqual(calls, { inquiry: 1, approve: 1, finalize: 1 });
});

test("parent-share summary expires and never exposes account or payer PII", () => {
  const order = makeOrder({
    status: "created",
    shareExpiresAt: new Date("2026-09-20T12:00:00.000Z"),
    payerFullName: "Parent Name",
    payerEmail: "parent@example.com",
    payerPhone: "0501234567",
  });
  const summary = buildParentShareSummary(order, new Date("2026-09-19T12:00:00.000Z"));
  const json = JSON.stringify(summary);
  for (const sensitive of [
    order.userId,
    order.publicId,
    order.payerFullName,
    order.payerEmail,
    order.payerPhone,
  ]) {
    assert.equal(json.includes(sensitive), false);
  }
  assert.throws(
    () => buildParentShareSummary(order, new Date("2026-09-20T12:00:00.000Z")),
    (error) => error.code === "PAYMENT_SHARE_EXPIRED",
  );
});

test("public payment offer exposes only safe catalog, method, processor, and merchant data", () => {
  assert.deepEqual(
    getPublicPaymentOffer({
      enabled: true,
      personalizedFunnelV2: false,
      provider: "grow",
      availableMethods: ["card", "bit"],
      merchant: {
        legalName: "Configured Operator",
        contactEmail: "support@example.test",
      },
      userId: "must-not-leak",
      apiKey: "must-not-leak",
    }),
    {
      enabled: true,
      personalizedFunnelV2: false,
      product: {
        productKey: AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
        displayName: "פתיחת שתי ההתאמות המובילות",
        amountMinor: 1000,
        currency: "ILS",
        permanent: true,
        futureRecalculationsIncluded: true,
        vatIncludedWhereApplicable: true,
        billingType: "one_time",
      },
      paymentMethods: ["bit", "card"],
      processor: "Grow",
      receiptsProvided: true,
      hostedPayerDetails: false,
      merchant: {
        legalName: "Configured Operator",
        contactEmail: "support@example.test",
      },
    },
  );
});

test("disabled public offer keeps product and merchant but exposes no methods", () => {
  const offer = getPublicPaymentOffer({
    enabled: false,
    personalizedFunnelV2: false,
    provider: "disabled",
    configuredProvider: "grow",
    availableMethods: ["card"],
    merchant: { contactEmail: "support@example.test" },
  });
  assert.equal(offer.enabled, false);
  assert.equal(offer.personalizedFunnelV2, false);
  assert.deepEqual(offer.paymentMethods, []);
  assert.equal(offer.product.amountMinor, 1000);
  assert.equal(offer.processor, "Grow");
  assert.deepEqual(offer.merchant, { contactEmail: "support@example.test" });
});

test("public offer exposes the runtime personalized funnel rollback switch", () => {
  const previous = process.env.PERSONALIZED_FUNNEL_V2;
  const config = {
    enabled: false,
    provider: "disabled",
    configuredProvider: "grow",
    availableMethods: [],
    merchant: {},
  };
  try {
    delete process.env.PERSONALIZED_FUNNEL_V2;
    assert.equal(getPublicPaymentOffer(config).personalizedFunnelV2, true);
    process.env.PERSONALIZED_FUNNEL_V2 = "false";
    assert.equal(getPublicPaymentOffer(config).personalizedFunnelV2, false);
  } finally {
    if (previous === undefined) delete process.env.PERSONALIZED_FUNNEL_V2;
    else process.env.PERSONALIZED_FUNNEL_V2 = previous;
  }
});

test("open-order, retry, cancellation, PII, and refund decisions fail safely", () => {
  assert.equal(
    paymentOpenOrderKey("507f1f77bcf86cd799439011", AI_COUNSELOR_TOP_TWO_PRODUCT_KEY),
    `507f1f77bcf86cd799439011:${AI_COUNSELOR_TOP_TWO_PRODUCT_KEY}`,
  );
  assert.equal(
    isDefinitiveFailedCreate({
      status: "failed",
      createOutcome: "definitive_failure",
      providerProcessId: null,
      growProcessId: null,
      processCreatedAt: null,
    }),
    true,
  );
  assert.equal(
    isDefinitiveFailedCreate({
      status: "failed",
      createOutcome: "none",
      providerProcessId: null,
      growProcessId: null,
      processCreatedAt: null,
    }),
    false,
  );
  assert.equal(isDefinitiveFailedCreate({ status: "processing" }), false);
  assert.equal(
    isDefinitiveFailedCreate({ status: "failed", growProcessId: "possibly-created" }),
    false,
  );
  assert.equal(cancellationActionForStatus("created"), "expire");
  assert.equal(cancellationActionForStatus("failed"), "expire");
  assert.equal(cancellationActionForStatus("pending"), "provider_unavailable");
  assert.equal(cancellationActionForStatus("processing"), "provider_unavailable");
  assert.equal(cancellationActionForStatus("paid"), "refund_required");
  assert.deepEqual(payerPurgeFields(), {
    payerFullName: "",
    payerPhone: "",
    payerEmail: "",
  });
  assert.equal(refundOutcomeMayExist(true, null), true);
  assert.equal(refundOutcomeMayExist(false, { outcomeUnknown: true }), true);
  assert.equal(refundOutcomeMayExist(false, { outcomeUnknown: false }), false);
});

test("receipt classification uses stored sale and refund transaction identities", () => {
  const refundFirstOrder = makeOrder({
    status: "refunded",
    providerTransactionId: "sale-789",
    growTransactionId: "sale-789",
    refundTransactionId: "refund-333",
    invoiceTransactionId: "",
  });
  assert.equal(classifyInvoiceReceipt(refundFirstOrder, "refund-333"), "refund");
  assert.equal(classifyInvoiceReceipt(refundFirstOrder, "sale-789"), "sale");
  assert.throws(
    () => classifyInvoiceReceipt(refundFirstOrder, "unrelated"),
    (error) => error.code === "PAYMENT_INVOICE_TRANSACTION_MISMATCH",
  );
  assert.throws(
    () =>
      classifyInvoiceReceipt(
        { ...refundFirstOrder, status: "refund_requested", refundTransactionId: null },
        "refund-arrived-before-id-was-stored",
      ),
    (error) => error.code === "PAYMENT_INVOICE_TRANSACTION_MISMATCH",
  );
});

test("mock confirmation is blocked in production before database access", async () => {
  await assert.rejects(
    confirmMockPayment({
      userId: "user",
      publicId: "order",
      env: { NODE_ENV: "production" },
    }),
    (error) => error.code === "MOCK_PAYMENTS_FORBIDDEN" && error.statusCode === 404,
  );
});

test("grant and refund entitlement mutations are permanent and source-scoped", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  const order = makeOrder({
    status: "paid",
    providerTransactionId: "789",
    growTransactionId: "789",
  });
  const grant = buildEntitlementGrantOperation(order, makeEvidence(), now);
  assert.equal(grant.update.$set.status, "active");
  assert.equal(grant.update.$set.expiresAt, null);
  assert.equal(grant.update.$set.sourceOrderId, order._id);
  assert.equal(grant.update.$set.sourceTransactionId, "789");

  const refund = buildEntitlementRefundOperation(order, "refund-123", now);
  assert.equal(refund.filter.sourceOrderId, order._id);
  assert.equal(refund.filter.sourceTransactionId, "789");
  assert.equal(refund.update.$set.status, "revoked");
  assert.equal(refund.update.$set.refundedAt, now);
  assert.equal(refund.update.$set.refundTransactionId, "refund-123");
});

test("status serializer surfaces invoice metadata but never provider secrets", () => {
  const order = makeOrder({
    status: "paid",
    invoiceNumber: "INV-10",
    invoiceUrl: "https://secure.meshulam.co.il/invoice/opaque",
    refundInvoiceNumber: "CR-10",
    refundInvoiceUrl: "https://secure.meshulam.co.il/invoice/refund-opaque",
    termsAndCancellationAcceptedAt: new Date("2026-09-18T09:59:00.000Z"),
    adultPayerConfirmedAt: new Date("2026-09-18T09:59:00.000Z"),
    callbackSecretHash: "secret-hash",
    returnSecretHash: "return-hash",
    growProcessToken: PROCESS_TOKEN,
    growTransactionToken: TRANSACTION_TOKEN,
  });
  const serialized = serializePaymentOrder(order);
  assert.deepEqual(serialized.invoice, {
    number: "INV-10",
    url: "https://secure.meshulam.co.il/invoice/opaque",
  });
  assert.deepEqual(serialized.confirmations, {
    termsAndCancellationAccepted: true,
    adultPayerConfirmed: true,
  });
  assert.deepEqual(serialized.cancellation, {
    requestEligible: true,
    state: "eligible",
  });
  assert.deepEqual(serializePaymentOrder({ ...order, status: "refund_requested" }).cancellation, {
    requestEligible: false,
    state: "pending_provider",
  });
  assert.equal(serialized.refundReceipt, null);
  const refunded = serializePaymentOrder({ ...order, status: "refunded" });
  assert.deepEqual(refunded.cancellation, {
    requestEligible: false,
    state: "provider_confirmed",
  });
  assert.deepEqual(refunded.refundReceipt, {
    number: "CR-10",
    url: "https://secure.meshulam.co.il/invoice/refund-opaque",
  });
  const json = JSON.stringify(serialized);
  assert.equal(json.includes(PROCESS_TOKEN), false);
  assert.equal(json.includes(TRANSACTION_TOKEN), false);
  assert.equal(json.includes("secret-hash"), false);
});

test("cancellation history is limited to paid and provider-refund states", () => {
  assert.deepEqual(CANCELLATION_ORDER_STATUSES, ["paid", "refund_requested", "refunded"]);
  for (const status of CANCELLATION_ORDER_STATUSES) {
    const serialized = serializePaymentOrder(makeOrder({ status }));
    assert.ok(
      ["eligible", "pending_provider", "provider_confirmed"].includes(
        serialized.cancellation.state,
      ),
    );
  }
});
