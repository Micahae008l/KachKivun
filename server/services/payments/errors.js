const SAFE_DEFAULT_MESSAGE = "לא ניתן להשלים את פעולת התשלום כרגע.";

export class PaymentError extends Error {
  constructor(code, message = SAFE_DEFAULT_MESSAGE, statusCode = 400, options = {}) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = Boolean(options.retryable);
    this.outcomeUnknown = Boolean(options.outcomeUnknown);
    if (options.cause) this.cause = options.cause;
  }
}

export function cleanPaymentError(error) {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]{2,120}$/.test(error.code)
      ? error.code
      : "PAYMENT_ERROR";
  const raw =
    error instanceof PaymentError && typeof error.message === "string"
      ? error.message
      : SAFE_DEFAULT_MESSAGE;
  const message = raw
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return { code, message: message || SAFE_DEFAULT_MESSAGE, at: new Date() };
}

export function sendPaymentError(res, error, label = "[payments]") {
  const safe = cleanPaymentError(error);
  const status =
    error instanceof PaymentError && Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(label, safe.code);
  return res.status(status).json({
    error: status >= 500 ? SAFE_DEFAULT_MESSAGE : safe.message,
    code: safe.code,
  });
}
