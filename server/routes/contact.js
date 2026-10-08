import express from "express";
import rateLimit from "express-rate-limit";
import { sendSupportMessage } from "../utils/email.js";
import { logSecurityEvent } from "../utils/securityLog.js";

const router = express.Router();

export const CONTACT_TOPICS = {
  cancellation: "ביטול עסקה / החזר",
  payment: "תשלום או קבלה",
  bug: "תקלה באתר",
  account: "חשבון וכניסה",
  other: "אחר",
};

// ponytail: per-IP limit only; add a per-email limit if spam ever gets through.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logSecurityEvent("rate_limit_api", req, { statusCode: options.statusCode, message: "contact limiter" });
    res.status(options.statusCode).json({ error: "שלחתם כמה פניות ברצף. נסו שוב בעוד שעה.", code: "RATE_LIMIT_CONTACT" });
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

router.post("/", contactLimiter, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  // Honeypot: real users never see this field.
  if (str(body.website, 200)) return res.status(202).json({ ok: true });

  const topic = Object.hasOwn(CONTACT_TOPICS, body.topic) ? body.topic : null;
  const email = str(body.email, 254).toLowerCase();
  const name = str(body.name, 80);
  const message = str(body.message, 2000);
  const orderId = str(body.orderId, 64);
  if (!topic) return res.status(400).json({ error: "בחרו נושא לפנייה" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "נא להזין כתובת אימייל תקינה כדי שנוכל לחזור אליכם" });
  if (message.length < 10) return res.status(400).json({ error: "כתבו לפחות משפט אחד על הפנייה" });

  try {
    const result = await sendSupportMessage({ topic: CONTACT_TOPICS[topic], name, email, message, orderId });
    if (!result.delivered) {
      return res.status(503).json({ error: "שליחת הפנייה לא זמינה כרגע. נסו שוב מאוחר יותר." });
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("[contact] send failed:", error?.message);
    return res.status(502).json({ error: "לא הצלחנו לשלוח את הפנייה. נסו שוב בעוד רגע." });
  }
});

export default router;
