import { ApiError } from "./api";

const CODE_MESSAGES: Record<string, string> = {
  RATE_LIMIT_AUTH: "יותר מדי ניסיונות כניסה. המתינו כ־15 דקות ונסו שוב.",
  RATE_LIMIT_API: "יותר מדי בקשות. נסו שוב בעוד כמה דקות.",
  ACCOUNT_EXISTS: "כבר יש חשבון עם האימייל הזה, הזינו אותו וקבלו קוד כניסה.",
  OTP_INVALID: "קוד שגוי, ודאו 6 ספרות מהקוד האחרון, או שלחו קוד חדש.",
  OTP_EXPIRED: "הקוד פג תוקף. לחצו «שלחו קוד חדש».",
  OTP_MAX_ATTEMPTS: "יותר מדי ניסיונות. שלחו קוד חדש.",
  OTP_RESEND_COOLDOWN: "אפשר לשלוח קוד חדש בעוד כמה שניות.",
  REVIEW_PENDING: "כבר יש ביקורת ממתינה לאישור על התפקיד הזה.",
  TOKEN_CAP_EXCEEDED: "הגעתם למכסת הטוקנים. פנו למנהל המערכת.",
  EMAIL_DELIVERY_FAILED: "לא הצלחנו לשלוח אימייל. נסו שוב בעוד רגע.",
  VALIDATION_ERROR: "הנתונים שנשלחו לא תקינים.",
  INVALID_JSON: "בקשה לא תקינה. רעננו את הדף ונסו שוב.",
  PAYLOAD_TOO_LARGE: "הבקשה גדולה מדי.",
  URI_TOO_LONG: "כתובת הבקשה ארוכה מדי.",
  SERVER_ERROR: "שגיאת שרת. נסו שוב מאוחר יותר.",
};

function humanizeValidationMessage(message: string): string | null {
  if (/unknown (stats )?field:\s*gender/i.test(message)) {
    return "שגיאת תצורה בשרת סביב שדה המגדר. רעננו ונסו שוב, ואם זה חוזר פנו לתמיכה.";
  }
  if (/^Unknown (stats |user |preferences )?field:/i.test(message)) {
    return "שדה לא מזוהה בטופס. רעננו את הדף ונסו שוב.";
  }
  return null;
}

/** User-facing message from API or network errors. */
export function getErrorMessage(err: unknown, fallback = "שגיאה"): string {
  if (err instanceof ApiError) {
    // status 0 = the request never reached the server. The browser's own text is
    // untranslated English ("Load failed" on Safari, "Failed to fetch" on Chrome).
    if (err.status === 0) {
      return "לא הצלחנו להגיע לשרת. בדקו את החיבור לאינטרנט ונסו שוב בעוד רגע.";
    }
    const fromCode = err.code ? CODE_MESSAGES[err.code] : undefined;
    if (fromCode && (!err.message || err.message === "Too Many Requests")) return fromCode;
    if (err.message) {
      const nicer = humanizeValidationMessage(err.message);
      if (nicer) return nicer;
      return err.message;
    }
    if (fromCode) return fromCode;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Map auth API failures to the field that should show the inline error. */
export function authErrorField(err: unknown): "email" | "code" | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "ACCOUNT_EXISTS" || err.code === "EMAIL_DELIVERY_FAILED") return "email";
  if (err.status === 502) return "email";
  if (
    err.code === "OTP_INVALID" ||
    err.code === "OTP_EXPIRED" ||
    err.code === "OTP_MAX_ATTEMPTS" ||
    err.code === "OTP_RESEND_COOLDOWN"
  ) {
    return "code";
  }
  if (err.status === 401) return "code";
  if (err.status === 400 || err.status === 429) {
    const m = err.message || "";
    if (m.includes("קוד")) return "code";
  }
  if (err.status === 400 && err.code === "VALIDATION_ERROR") {
    if (err.message.includes("אימייל")) return "email";
    if (err.message.includes("קוד")) return "code";
  }
  return null;
}
