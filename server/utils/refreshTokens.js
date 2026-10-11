import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";

export const REFRESH_TOKEN_COOKIE = "kachkivun_refresh";

const DEFAULT_REFRESH_DAYS = 30;

function refreshTokenDays() {
  const days = Number.parseInt(String(process.env.REFRESH_TOKEN_DAYS || ""), 10);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_REFRESH_DAYS;
}

export function refreshTokenMaxAgeMs() {
  return refreshTokenDays() * 24 * 60 * 60 * 1000;
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    if (key === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export function refreshCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    // Lax, not Strict: WebKit (Safari, Instagram's in-app browser) withholds Strict cookies on a
    // page reached from another site, so coming back from the payment page looked logged out.
    // Lax is still never sent on cross-site POST/fetch, and /refresh is POST-only.
    sameSite: "lax",
    path: "/api/auth",
    maxAge: refreshTokenMaxAgeMs(),
  };
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...refreshCookieOptions(),
    maxAge: undefined,
  });
}

export async function createRefreshTokenSession(userId, req) {
  const token = crypto.randomBytes(64).toString("base64url");
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + refreshTokenMaxAgeMs());

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    userAgent: String(req.get("user-agent") || "").slice(0, 500),
    ip: req.ip || "",
  });

  return { token, tokenHash, expiresAt };
}

export async function revokeRefreshToken(rawToken, replacementHash = null) {
  if (!rawToken) return null;
  const tokenHash = hashRefreshToken(rawToken);
  return RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date(), replacedByTokenHash: replacementHash } },
    { new: true },
  );
}
