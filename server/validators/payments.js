import { PAYMENT_METHODS } from "../models/PaymentOrder.js";
import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import {
  fail,
  ok,
  parseEnum,
  parseString,
  requirePlainObject,
} from "../utils/sanitize.js";

function rejectUnknownFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return fail(`Unknown ${label} field: ${key}`);
  }
  return ok(value);
}

export function parsePayerFullName(value) {
  const parsed = parseString(value, {
    label: "fullName",
    minLen: 3,
    maxLen: 120,
  });
  if (!parsed.ok) return parsed;
  const fullName = parsed.value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const words = fullName.split(" ");
  if (words.length < 2 || words.some((word) => !/^[\p{L}][\p{L}\p{M}'׳״-]*$/u.test(word))) {
    return fail("נא להזין שם מלא הכולל לפחות שתי מילים");
  }
  return ok(fullName);
}

export function parseIsraeliMobile(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return fail("נא להזין מספר נייד ישראלי תקין");
  }
  const raw = String(value).trim();
  if (!/^[+()\d\s-]+$/.test(raw)) return fail("נא להזין מספר נייד ישראלי תקין");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  if (!/^05\d{8}$/.test(digits)) return fail("נא להזין מספר נייד ישראלי תקין");
  return ok(digits);
}

function parseProductKey(value) {
  const productKey = String(value || AI_COUNSELOR_TOP_TWO_PRODUCT_KEY).trim();
  if (productKey !== AI_COUNSELOR_TOP_TWO_PRODUCT_KEY) {
    return fail("המוצר המבוקש אינו זמין");
  }
  return ok(productKey);
}

function parsePayer(value) {
  if (value === undefined || value === null) return ok(null);
  const payer = requirePlainObject(value, "payer");
  if (!payer.ok) return payer;
  const unknown = rejectUnknownFields(payer.value, ["fullName", "phone"], "payer");
  if (!unknown.ok) return unknown;

  const fullName = parsePayerFullName(payer.value.fullName);
  if (!fullName.ok) return fullName;
  const phone = parseIsraeliMobile(payer.value.phone);
  if (!phone.ok) return phone;
  return ok({ fullName: fullName.value, phone: phone.value });
}

function parseConfirmations(value) {
  const confirmations = requirePlainObject(value, "confirmations");
  if (!confirmations.ok) return confirmations;
  const unknown = rejectUnknownFields(
    confirmations.value,
    ["termsAndCancellationAccepted", "adultPayerConfirmed"],
    "confirmations",
  );
  if (!unknown.ok) return unknown;
  if (confirmations.value.termsAndCancellationAccepted !== true) {
    return fail("יש לאשר את תנאי השימוש ומדיניות הביטול");
  }
  if (confirmations.value.adultPayerConfirmed !== true) {
    return fail("יש לאשר שהמשלם או המשלמת בגירים");
  }
  return ok({
    termsAndCancellationAccepted: true,
    adultPayerConfirmed: true,
  });
}

function parsePaymentMethod(value) {
  if (value === undefined || value === null || value === "") return ok(null);
  return parseEnum(value, PAYMENT_METHODS, { label: "paymentMethod" });
}

export function validateCheckout(req) {
  const body = requirePlainObject(req.body, "body");
  if (!body.ok) return body;
  const unknown = rejectUnknownFields(
    body.value,
    ["productKey", "idempotencyKey", "payer", "paymentMethod", "confirmations"],
    "body",
  );
  if (!unknown.ok) return unknown;

  const productKey = parseProductKey(body.value.productKey);
  if (!productKey.ok) return productKey;
  const idempotencyKey = parseString(body.value.idempotencyKey, {
    label: "idempotencyKey",
    minLen: 36,
    maxLen: 36,
  });
  if (!idempotencyKey.ok) return idempotencyKey;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey.value,
    )
  ) {
    return fail("idempotencyKey must be a UUID");
  }
  const payer = parsePayer(body.value.payer);
  if (!payer.ok) return payer;
  const method = parsePaymentMethod(body.value.paymentMethod);
  if (!method.ok) return method;
  const confirmations = parseConfirmations(body.value.confirmations);
  if (!confirmations.ok) return confirmations;

  req.body = {
    productKey: productKey.value,
    idempotencyKey: idempotencyKey.value.toLowerCase(),
    payer: payer.value,
    paymentMethod: method.value,
    confirmations: confirmations.value,
  };
  return { ok: true };
}

export function validateShareCheckout(req) {
  const body = requirePlainObject(req.body, "body");
  if (!body.ok) return body;
  const unknown = rejectUnknownFields(
    body.value,
    ["payer", "paymentMethod", "confirmations"],
    "body",
  );
  if (!unknown.ok) return unknown;
  const payer = parsePayer(body.value.payer);
  if (!payer.ok) return payer;
  const method = parsePaymentMethod(body.value.paymentMethod);
  if (!method.ok) return method;
  const confirmations = parseConfirmations(body.value.confirmations);
  if (!confirmations.ok) return confirmations;
  req.body = {
    payer: payer.value,
    paymentMethod: method.value,
    confirmations: confirmations.value,
  };
  return { ok: true };
}

export function validateParentShare(req) {
  const body = requirePlainObject(req.body, "body");
  if (!body.ok) return body;
  const unknown = rejectUnknownFields(body.value, ["productKey"], "body");
  if (!unknown.ok) return unknown;
  const productKey = parseProductKey(body.value.productKey);
  if (!productKey.ok) return productKey;
  req.body = { productKey: productKey.value };
  return { ok: true };
}

export function validateRefundRequest(req) {
  const body = requirePlainObject(req.body, "body");
  if (!body.ok) return body;
  const unknown = rejectUnknownFields(body.value, ["reason"], "body");
  if (!unknown.ok) return unknown;
  const reason =
    body.value.reason === undefined
      ? ok("")
      : parseString(body.value.reason, {
          label: "reason",
          maxLen: 200,
          allowEmpty: true,
        });
  if (!reason.ok) return reason;
  req.body = { reason: reason.value };
  return { ok: true };
}

export const validateCancellationRequest = validateRefundRequest;
