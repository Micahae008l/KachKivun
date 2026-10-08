import SecurityEvent from "../models/SecurityEvent.js";

const FIELD_MAX = {
  ip: 64,
  method: 12,
  path: 512,
  userAgent: 256,
  email: 254,
  message: 500,
};

const SEVERITY_BY_TYPE = {
  rate_limit_api: "medium",
  rate_limit_auth: "high",
  otp_failed: "medium",
  otp_locked: "high",
  invalid_token: "high",
  admin_denied: "critical",
  oversized_url: "medium",
  payload_too_large: "medium",
  invalid_json: "low",
  suspicious_path: "high",
  not_found_probe: "low",
  blocked_ip_hit: "medium",
};

function clip(value, max) {
  return String(value ?? "").slice(0, max);
}

export function getClientIp(req) {
  return clip(req?.ip || req?.socket?.remoteAddress || "", FIELD_MAX.ip);
}

export function sanitizeSecurityPath(value) {
  let path = String(value || "").split(/[?#]/, 1)[0] || "/";
  path = path.replace(
    /^(\/api\/payments\/webhooks\/grow\/(?:notify|invoice))\/[^/]+\/[^/]+/i,
    "$1/:order/:secret",
  );
  path = path.replace(
    /^(\/api\/payments\/return)\/[^/]+\/[^/]+/i,
    "$1/:order/:token",
  );
  path = path.replace(
    /^(\/api\/payments\/share)\/[^/]+(?=\/|$)/i,
    "$1/:share",
  );
  return clip(path, FIELD_MAX.path);
}

/**
 * Fire-and-forget security event logger. Never throws and never blocks the
 * request path — a logging failure must not turn into a request failure.
 */
export function logSecurityEvent(type, req, extra = {}) {
  try {
    const doc = {
      type,
      severity: extra.severity || SEVERITY_BY_TYPE[type] || "low",
      ip: getClientIp(req),
      method: clip(req?.method, FIELD_MAX.method),
      path: sanitizeSecurityPath(req?.originalUrl || req?.url),
      userAgent: clip(req?.headers?.["user-agent"], FIELD_MAX.userAgent),
      email: clip(extra.email, FIELD_MAX.email).toLowerCase(),
      userId: extra.userId || null,
      statusCode: extra.statusCode ?? null,
      message: clip(extra.message, FIELD_MAX.message),
    };
    SecurityEvent.create(doc).catch((err) => {
      console.error("[security/log] failed to persist event:", err?.message);
    });
  } catch (err) {
    console.error("[security/log] failed to build event:", err?.message);
  }
}
