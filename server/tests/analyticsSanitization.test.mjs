import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAnalyticsPath,
  sanitizeAnalyticsProps,
  sanitizeAnalyticsUrl,
} from "../../src/lib/analytics-sanitization.js";

test("analytics URLs remove query, hash, and dynamic share/return identifiers", () => {
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://app.example.test/checkout/shareSecret123?order=order-secret#callback-token",
    ),
    "https://app.example.test/checkout/:share",
  );
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://app.example.test/payment/return?order=order-secret&token=return-secret",
    ),
    "https://app.example.test/payment/return",
  );
  assert.equal(
    sanitizeAnalyticsUrl("https://app.example.test/report/private-id?share=secret"),
    "https://app.example.test/report/:id",
  );
  assert.equal(normalizeAnalyticsPath("/about/?email=person@example.test#x"), "/about");
});

test("analytics props retain only event-specific finite non-PII values", () => {
  assert.deepEqual(
    sanitizeAnalyticsProps("assessment_section", {
      section: "technical",
      email: "person@example.test",
      name: "Person Name",
      phone: "0501234567",
      extraNote: "free text",
      roleTitle: "secret role",
      profileScore: 97,
      orderId: "order-secret",
      token: "token-secret",
      error: "raw provider error",
    }),
    { section: "technical" },
  );
  assert.deepEqual(
    sanitizeAnalyticsProps("checkout_started", {
      flow: "shared",
      browser: "instagram",
      userAgent: "full identifying user agent",
      shareToken: "secret",
    }),
    { flow: "shared", browser: "instagram" },
  );
  assert.equal(
    sanitizeAnalyticsProps("payment_method_selected", {
      method: "wire_transfer",
      payer: "Person",
    }),
    undefined,
  );
});

test("events without props cannot accidentally transmit caller data", () => {
  assert.equal(
    sanitizeAnalyticsProps("payment_confirmed", {
      orderId: "order-secret",
      email: "person@example.test",
    }),
    undefined,
  );
  assert.equal(sanitizeAnalyticsProps("unknown_event", { safe: "no" }), undefined);
});
