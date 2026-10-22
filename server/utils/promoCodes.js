import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY } from "../services/payments/catalog.js";
import { isActiveEntitlement } from "./recommendationAccess.js";

export const PROMO_SOURCE = "promo";
const CODE_RE = /^[A-Z0-9-]{3,32}$/;
// No 0/O or 1/I: codes get read aloud and typed from a story screenshot.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "kk-test 1" -> "KK-TEST1". Returns "" when the result is not a valid code. */
export function normalizePromoCode(raw) {
  const code = String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return CODE_RE.test(code) ? code : "";
}

export function generatePromoCode(random = Math.random) {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `KK-${tail}`;
}

export class PromoError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Why a code that could not be consumed was refused, in the words the user sees. */
function refusal(promo, now) {
  if (!promo || !promo.active)
    return new PromoError("PROMO_INVALID", "הקוד לא תקין או שכבר לא בתוקף");
  if (promo.expiresAt && new Date(promo.expiresAt) <= now) {
    return new PromoError("PROMO_EXPIRED", "תוקף הקוד הסתיים");
  }
  return new PromoError("PROMO_USED_UP", "הקוד כבר נוצל עד הסוף");
}

/**
 * Unlocks the paid places for a user with a promo code. A use is taken from the code only
 * when the code is valid and the user is not already unlocked; if granting then fails, the
 * use is given back.
 */
export async function redeemPromoCode({
  userId,
  rawCode,
  PromoModel,
  EntitlementModel,
  now = new Date(),
}) {
  const code = normalizePromoCode(rawCode);
  if (!code) throw new PromoError("PROMO_INVALID", "הקוד לא תקין או שכבר לא בתוקף");

  const productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY;
  const existing = await EntitlementModel.findOne({ userId, productKey }).lean();
  if (isActiveEntitlement(existing, now)) return { status: "already_unlocked", code };

  const promo = await PromoModel.findOneAndUpdate(
    {
      code,
      active: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  if (!promo) throw refusal(await PromoModel.findOne({ code }).lean(), now);

  try {
    await EntitlementModel.findOneAndUpdate(
      { userId, productKey },
      {
        $set: {
          status: "active",
          source: PROMO_SOURCE,
          sourceTransactionId: code,
          startsAt: now,
          expiresAt: null,
          revokedAt: null,
          revokedReason: "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    await PromoModel.updateOne({ _id: promo._id }, { $inc: { usedCount: -1 } });
    throw error;
  }
  return { status: "unlocked", code };
}
