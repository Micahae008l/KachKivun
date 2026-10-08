import rateLimit from "express-rate-limit";
import { logSecurityEvent } from "../utils/securityLog.js";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** All /api routes — generous default so normal app use is unaffected. */
export const apiLimiter = rateLimit({
  windowMs: parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: parsePositiveInt(process.env.API_RATE_LIMIT_MAX, 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "GET" && (req.path === "/health" || req.originalUrl === "/api/health"),
  handler: (req, res, _next, options) => {
    logSecurityEvent("rate_limit_api", req, { statusCode: options.statusCode });
    res.status(options.statusCode).json({
      error: "יותר מדי בקשות. נסו שוב בעוד כמה דקות.",
      code: "RATE_LIMIT_API",
    });
  },
});

/**
 * Grow retries callbacks for delivery assurance. Keep this isolated from the
 * general API budget so webhook retries cannot starve authenticated traffic.
 */
export const growWebhookLimiter = rateLimit({
  windowMs: parsePositiveInt(process.env.PAYMENT_WEBHOOK_RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: parsePositiveInt(process.env.PAYMENT_WEBHOOK_RATE_LIMIT_MAX, 600),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logSecurityEvent("rate_limit_api", req, {
      statusCode: options.statusCode,
      message: "grow webhook limiter",
    });
    res.status(options.statusCode).json({
      error: "Too many callback attempts",
      code: "RATE_LIMIT_PAYMENT_WEBHOOK",
    });
  },
});

/** Login / OTP / registration — 5 attempts per 15 minutes per IP. */
export const authLimiter = rateLimit({
  windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 5),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logSecurityEvent("rate_limit_auth", req, {
      statusCode: options.statusCode,
      email: req.body?.email,
    });
    res.status(options.statusCode).json({
      error: "יותר מדי ניסיונות כניסה. נסו שוב בעוד 15 דקות.",
      code: "RATE_LIMIT_AUTH",
    });
  },
});
