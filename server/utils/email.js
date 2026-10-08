import nodemailer from "nodemailer";
import { SITE_NAME_HE } from "./brand.js";

let transporterPromise;
let warnedNoSmtp;

const OTP_TTL_MINUTES = 10;

/** Brand colors as hex — email clients ignore oklch/CSS vars. */
const C = {
  bg: "#0f1210",
  card: "#1a1f1b",
  border: "#2e362f",
  text: "#f2f0ea",
  muted: "#a8aea4",
  olive: "#6b8f5e",
  codeBg: "#0c0e0c",
  codeBorder: "#6b8f5e",
  white: "#ffffff",
};

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

/** True when real SMTP send is possible (OTP will not only go to console). */
export function isSmtpConfigured() {
  return Boolean(trimEnv("SMTP_HOST") && trimEnv("SMTP_USER") && trimEnv("SMTP_PASS"));
}

/** Resend (transactional email API) — preferred when configured; better deliverability than Gmail SMTP. */
export function isResendConfigured() {
  return Boolean(trimEnv("RESEND_API_KEY"));
}

/** True when any real delivery channel exists (Resend or SMTP). */
export function isEmailConfigured() {
  return isResendConfigured() || isSmtpConfigured();
}

async function sendViaResend({ from, to, subject, html, text, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${trimEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return { delivered: true };
}

function smtpReady() {
  return isSmtpConfigured();
}

async function getTransporter() {
  if (!smtpReady()) return null;
  if (!transporterPromise) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true";
    transporterPromise = nodemailer.createTransport({
      host: trimEnv("SMTP_HOST"),
      port,
      secure,
      auth: {
        user: trimEnv("SMTP_USER"),
        pass: trimEnv("SMTP_PASS"),
      },
      requireTLS: !secure && port === 587,
    });
  }
  return transporterPromise;
}

/**
 * Check the delivery channel works without sending anything: Resend's key is
 * accepted (and the domain verified, when the key may read it), or the SMTP
 * login succeeds.
 */
export async function verifyEmailChannel() {
  if (isResendConfigured()) {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${trimEnv("RESEND_API_KEY")}` },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    // A send-only key may not list domains, but Resend only says so for a real key.
    if (res.status === 401 && body?.name === "restricted_api_key") {
      return { ok: true, channel: "resend", detail: "send-only key accepted" };
    }
    if (!res.ok) return { ok: false, channel: "resend", detail: `HTTP ${res.status} ${body?.message ?? ""}`.trim() };
    const domains = Array.isArray(body?.data) ? body.data : [];
    const unverified = domains.filter((d) => d.status !== "verified").map((d) => `${d.name}: ${d.status}`);
    return unverified.length
      ? { ok: false, channel: "resend", detail: `domain not verified (${unverified.join(", ")})` }
      : { ok: true, channel: "resend", detail: `${domains.length} domain(s) verified` };
  }

  const transporter = await getTransporter();
  if (!transporter) return { ok: false, channel: "none", detail: "no RESEND_API_KEY or SMTP_* set" };
  await transporter.verify();
  return { ok: true, channel: "smtp", detail: "login accepted" };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build OTP HTML.
 * Note: Gmail/Outlook block JS — no real clipboard API.
 * We use user-select:all so one click/tap selects the whole code for copy,
 * plus a large tap target and clear Hebrew hint.
 * Digits stay continuous (letter-spacing only) so paste into the OTP field works.
 */
function buildOtpHtml({ siteName, code, ttlMinutes, appUrl }) {
  const safeName = escapeHtml(siteName);
  const safeCode = escapeHtml(String(code));
  const year = new Date().getFullYear();
  const loginHref = appUrl ? escapeHtml(appUrl.replace(/\/$/, "") + "/post-signup") : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>קוד הכניסה שלך</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    קוד הכניסה שלך ל${safeName}: ${safeCode}. תקף ל־${ttlMinutes} דקות.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:${C.olive};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 28px 28px;font-family:Arial,Helvetica,sans-serif;color:${C.text};text-align:center;" dir="rtl">
              <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.12em;color:${C.olive};font-weight:700;">
                ${safeName}
              </p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;font-weight:700;color:${C.white};">
                קוד הכניסה שלך
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${C.muted};">
                הזינו את הקוד במסך ההתחברות. הקוד חד־פעמי ותקף ל־${ttlMinutes} דקות.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
                <tr>
                  <td align="center" style="background:${C.codeBg};border:1px solid ${C.codeBorder};border-radius:12px;padding:22px 16px;">
                    <p style="margin:0 0 10px;font-size:12px;color:${C.muted};">
                      לחצו על הקוד כדי לסמן אותו — ואז העתיקו
                    </p>
                    <a href="#otp-code" id="otp-code" style="display:inline-block;font-family:'Courier New',Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:0.35em;line-height:1.2;color:${C.white};text-decoration:none;direction:ltr;-webkit-user-select:all;-moz-user-select:all;user-select:all;cursor:pointer;padding:4px 8px 4px 18px;">${safeCode}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${C.muted};">
                בטלפון: לחיצה ארוכה על הקוד ← העתקה · במחשב: לחיצה אחת ← Ctrl+C / ⌘C
              </p>

              ${
                loginHref
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:${C.olive};">
                    <a href="${loginHref}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${C.white};text-decoration:none;border-radius:10px;">
                      חזרה להתחברות
                    </a>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              <p style="margin:0;font-size:12px;line-height:1.55;color:${C.muted};">
                לא ביקשתם קוד? התעלמו מהמייל — אל תשתפו את הקוד עם אף אחד.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.muted};text-align:center;" dir="rtl">
              © ${year} ${safeName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpText({ siteName, code, ttlMinutes, appUrl }) {
  const lines = [
    `קוד הכניסה שלך ל${siteName}:`,
    "",
    code,
    "",
    `הקוד תקף ל־${ttlMinutes} דקות.`,
    "העתיקו את הקוד והדביקו במסך ההתחברות.",
    "",
    "לא ביקשתם קוד? התעלמו מהמייל.",
  ];
  if (appUrl) {
    lines.push("", `התחברות: ${appUrl.replace(/\/$/, "")}/post-signup`);
  }
  return lines.join("\n");
}

export async function sendOtpEmail(email, code) {
  const appUrl = trimEnv("FRONTEND_URL");

  // Code first in subject → iOS/Android notification often shows it for one-tap fill/copy
  const subject = `${code} הוא קוד הכניסה שלך ל${SITE_NAME_HE}`;
  const text = buildOtpText({ siteName: SITE_NAME_HE, code, ttlMinutes: OTP_TTL_MINUTES, appUrl });
  const html = buildOtpHtml({ siteName: SITE_NAME_HE, code, ttlMinutes: OTP_TTL_MINUTES, appUrl });

  // Preferred path: Resend (domain-authenticated, high deliverability).
  if (isResendConfigured()) {
    const from =
      trimEnv("RESEND_FROM") ||
      trimEnv("SMTP_FROM") ||
      `${SITE_NAME_HE} <no-reply@kachkivun.com>`;
    return sendViaResend({ from, to: email, subject, html, text });
  }

  // Fallback: existing Gmail/SMTP transport.
  const from =
    trimEnv("SMTP_FROM") || `${SITE_NAME_HE} <${trimEnv("SMTP_USER") || "no-reply@kachkivun.local"}>`;
  const transporter = await getTransporter();

  if (!transporter) {
    if (!warnedNoSmtp) {
      warnedNoSmtp = true;
      console.warn(
        "[email] אין ערוץ שליחה — הגדירו RESEND_API_KEY (מומלץ) או SMTP_HOST/SMTP_USER/SMTP_PASS ב־server/.env."
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth/otp] dev code for ${email}: ${code}`);
    }
    return { delivered: false };
  }

  await transporter.sendMail({ from, to: email, subject, text, html });
  return { delivered: true };
}

/**
 * Contact-form message to the support inbox (SUPPORT_EMAIL, falling back to BUSINESS_CONTACT_EMAIL).
 * Reply-To is the sender, so answering from the inbox goes straight to them.
 */
export async function sendSupportMessage({ topic, name, email, message, orderId }) {
  const to = trimEnv("SUPPORT_EMAIL") || trimEnv("BUSINESS_CONTACT_EMAIL");
  const subject = `[${SITE_NAME_HE}] ${topic}${name ? ` · ${name}` : ""}`;
  const lines = [`נושא: ${topic}`, `מאת: ${name || "(לא צוין שם)"} <${email}>`, orderId ? `הזמנה: ${orderId}` : "", "", message].filter(
    (line, i) => line || i >= 3,
  );
  const text = lines.join("\n");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${lines
    .map((l) => (l ? escapeHtml(l) : "<br>"))
    .join("<br>")}</div>`;

  if (!to) {
    console.warn("[contact] SUPPORT_EMAIL/BUSINESS_CONTACT_EMAIL not set; message not sent");
    if (process.env.NODE_ENV !== "production") console.log(`[contact] dev message:\n${text}`);
    return { delivered: false };
  }
  if (isResendConfigured()) {
    const from = trimEnv("RESEND_FROM") || `${SITE_NAME_HE} <no-reply@kachkivun.com>`;
    return sendViaResend({ from, to, subject, html, text, replyTo: email });
  }
  const transporter = await getTransporter();
  if (!transporter) return { delivered: false };
  const from = trimEnv("SMTP_FROM") || `${SITE_NAME_HE} <${trimEnv("SMTP_USER")}>`;
  await transporter.sendMail({ from, to, subject, text, html, replyTo: email });
  return { delivered: true };
}
