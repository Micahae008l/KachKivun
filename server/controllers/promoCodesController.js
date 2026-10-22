import PromoCode from "../models/PromoCode.js";
import Entitlement from "../models/Entitlement.js";
import { sendServerError } from "../utils/httpError.js";
import {
  PromoError,
  generatePromoCode,
  normalizePromoCode,
  redeemPromoCode,
} from "../utils/promoCodes.js";

const toDto = (promo) => ({
  id: String(promo._id),
  code: promo.code,
  note: promo.note || "",
  maxUses: promo.maxUses ?? null,
  usedCount: promo.usedCount || 0,
  expiresAt: promo.expiresAt || null,
  active: Boolean(promo.active),
  createdAt: promo.createdAt,
});

export async function listPromoCodes(req, res) {
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ codes: codes.map(toDto) });
  } catch (err) {
    return sendServerError(res, err, "[admin/promo-codes/list]");
  }
}

export async function createPromoCode(req, res) {
  try {
    const body = req.body || {};
    const wanted = String(body.code ?? "").trim();
    const code = wanted ? normalizePromoCode(wanted) : generatePromoCode();
    if (!code) {
      return res
        .status(400)
        .json({ error: "קוד יכול להכיל אותיות באנגלית, מספרים ומקף, 3 עד 32 תווים" });
    }
    const maxUses = body.maxUses == null || body.maxUses === "" ? null : Number(body.maxUses);
    if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)) {
      return res.status(400).json({ error: "מספר שימושים חייב להיות מספר שלם, 1 ומעלה" });
    }
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "תאריך תפוגה לא תקין" });
    }
    if (await PromoCode.exists({ code })) {
      return res.status(409).json({ error: "הקוד הזה כבר קיים" });
    }
    const promo = await PromoCode.create({
      code,
      note: String(body.note ?? "").slice(0, 200),
      maxUses,
      expiresAt,
      createdBy: req.userId,
    });
    res.status(201).json({ code: toDto(promo) });
  } catch (err) {
    return sendServerError(res, err, "[admin/promo-codes/create]");
  }
}

/** Turning a code off stops new redemptions; people who already used it stay unlocked. */
export async function updatePromoCode(req, res) {
  try {
    if (typeof req.body?.active !== "boolean") {
      return res.status(400).json({ error: "active must be true or false" });
    }
    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      { $set: { active: req.body.active } },
      { new: true },
    ).lean();
    if (!promo) return res.status(404).json({ error: "הקוד לא נמצא" });
    res.json({ code: toDto(promo) });
  } catch (err) {
    return sendServerError(res, err, "[admin/promo-codes/update]");
  }
}

export async function redeemPromo(req, res) {
  try {
    const result = await redeemPromoCode({
      userId: req.userId,
      rawCode: req.body?.code,
      PromoModel: PromoCode,
      EntitlementModel: Entitlement,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof PromoError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return sendServerError(res, err, "[payments/redeem]");
  }
}
