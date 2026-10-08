import { isPaywallEnabled } from "../services/payments/config.js";

export function paymentDisabledBody() {
  return {
    enabled: false,
    error: "התשלומים אינם זמינים כרגע.",
    code: "PAYMENTS_DISABLED",
  };
}

export function requirePaymentsEnabled(_req, res, next) {
  if (!isPaywallEnabled()) {
    return res.status(503).json(paymentDisabledBody());
  }
  return next();
}
