import mongoose from "mongoose";
import { fail, parseEnum, parsePagination, parseSearchQuery, parseString, requirePlainObject } from "../utils/sanitize.js";
import { SECURITY_EVENT_TYPES, SECURITY_SEVERITIES } from "../models/SecurityEvent.js";

export function validateAdminUsersQuery(req) {
  const qResult = parseSearchQuery(req.query?.q);
  if (!qResult.ok) return qResult;

  const page = parsePagination(req.query, { defaultLimit: 50, maxLimit: 500 });
  if (!page.ok) return page;

  req.query = {
    ...req.query,
    q: qResult.value,
    limit: String(page.value.limit),
    skip: String(page.value.skip),
  };
  return { ok: true };
}

export function validateAdminUserTokenCap(req) {
  const id = String(req.params?.id || "");
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return fail("Invalid user id");
  }

  const bodyResult = requirePlainObject(req.body, "body");
  if (!bodyResult.ok) return bodyResult;

  const allowed = ["tokenCap"];
  for (const key of Object.keys(bodyResult.value)) {
    if (!allowed.includes(key)) return fail(`Unknown field: ${key}`);
  }

  if (!("tokenCap" in bodyResult.value)) {
    return fail("tokenCap is required");
  }

  const raw = bodyResult.value.tokenCap;
  let tokenCap = null;
  if (raw !== null) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
      return fail("tokenCap must be a non-negative integer or null");
    }
    tokenCap = raw;
  }

  req.params = { ...req.params, id };
  req.body = { tokenCap };
  return { ok: true };
}

export function validateAdminUserRole(req) {
  const id = String(req.params?.id || "");
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return fail("Invalid user id");
  }

  const bodyResult = requirePlainObject(req.body, "body");
  if (!bodyResult.ok) return bodyResult;

  const allowed = ["role"];
  for (const key of Object.keys(bodyResult.value)) {
    if (!allowed.includes(key)) return fail(`Unknown field: ${key}`);
  }

  const roleResult = parseEnum(bodyResult.value.role, ["user", "admin"], { label: "role" });
  if (!roleResult.ok) return roleResult;

  req.params = { ...req.params, id };
  req.body = { role: roleResult.value };
  return { ok: true };
}

export function validateObjectIdParam(paramName = "id") {
  return (req) => {
    const id = String(req.params?.[paramName] || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(`Invalid ${paramName}`);
    }
    return { ok: true };
  };
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){1,7}$/i;

function isValidIp(ip) {
  const v4 = ip.match(IPV4_RE);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255);
  }
  return IPV6_RE.test(ip) && ip.includes(":");
}

export function validateSecurityEventsQuery(req) {
  const page = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  if (!page.ok) return page;

  const sanitized = { limit: String(page.value.limit), skip: String(page.value.skip) };

  if (req.query?.type !== undefined && req.query.type !== "") {
    const type = parseEnum(req.query.type, SECURITY_EVENT_TYPES, { label: "type" });
    if (!type.ok) return type;
    sanitized.type = type.value;
  }

  if (req.query?.severity !== undefined && req.query.severity !== "") {
    const severity = parseEnum(req.query.severity, SECURITY_SEVERITIES, { label: "severity" });
    if (!severity.ok) return severity;
    sanitized.severity = severity.value;
  }

  if (req.query?.ip !== undefined && req.query.ip !== "") {
    const ip = parseString(req.query.ip, { maxLen: 64, label: "ip" });
    if (!ip.ok) return ip;
    sanitized.ip = ip.value;
  }

  req.query = sanitized;
  return { ok: true };
}

export function validateBlockIp(req) {
  const bodyResult = requirePlainObject(req.body, "body");
  if (!bodyResult.ok) return bodyResult;

  const allowed = ["ip", "reason"];
  for (const key of Object.keys(bodyResult.value)) {
    if (!allowed.includes(key)) return fail(`Unknown field: ${key}`);
  }

  const ipResult = parseString(bodyResult.value.ip, { maxLen: 64, minLen: 3, label: "ip" });
  if (!ipResult.ok) return ipResult;
  if (!isValidIp(ipResult.value)) {
    return fail("כתובת IP לא תקינה");
  }

  let reason = "";
  if (bodyResult.value.reason !== undefined && bodyResult.value.reason !== null) {
    const reasonResult = parseString(bodyResult.value.reason, {
      maxLen: 200,
      label: "reason",
      allowEmpty: true,
    });
    if (!reasonResult.ok) return reasonResult;
    reason = reasonResult.value;
  }

  req.body = { ip: ipResult.value, reason };
  return { ok: true };
}
