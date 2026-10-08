import crypto from "crypto";

export function createOpaqueSecret(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 24) {
    throw new TypeError("Payment secrets require at least 24 random bytes");
  }
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashPaymentSecret(secret) {
  return crypto.createHash("sha256").update(String(secret), "utf8").digest("hex");
}

export function paymentSecretMatches(secret, expectedHash) {
  if (typeof secret !== "string" || typeof expectedHash !== "string") return false;
  if (secret.length < 24 || secret.length > 512 || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashPaymentSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function paymentPayloadFingerprint(fields) {
  const canonical = JSON.stringify(fields, Object.keys(fields || {}).sort());
  return hashPaymentSecret(canonical);
}
