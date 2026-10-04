import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { sendServerError } from "../utils/httpError.js";
import { getPaymentProvider, TOP2_PRICE_AGOROT } from "../utils/payments/index.js";
import { isPaywallEnabled, isTopUnlocked } from "../utils/topMatchLock.js";

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:8080").trim().replace(/\/$/, "");
}

/**
 * Mark a payment paid and unlock the buyer, once. A repeat confirmation (provider
 * retries, a double redirect) finds the payment already paid and changes nothing.
 */
export async function confirmPayment(paymentId, { transactionId, raw = null }) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: { status: "paid", paidAt: new Date(), transactionId, raw } },
    { new: true },
  );
  if (!payment) return null;
  await User.updateOne(
    { _id: payment.userId, topMatchesUnlockedAt: null },
    { $set: { topMatchesUnlockedAt: payment.paidAt } },
  );

  return payment;
}

/** POST /api/payments/top-matches/checkout → { url } of the page that takes the ₪10. */
export async function startTopMatchesCheckout(req, res) {
  try {
    if (!isPaywallEnabled()) {
      return res.status(404).json({ error: "Not available", code: "PAYWALL_OFF" });
    }
    if (await isTopUnlocked(req.userId)) {
      return res.json({ alreadyUnlocked: true });
    }
    const provider = getPaymentProvider();
    if (!provider) {
      return res.status(503).json({ error: "התשלום לא זמין כרגע, נסו שוב מאוחר יותר", code: "PAYMENTS_UNAVAILABLE" });
    }

    const payment = await Payment.create({
      userId: req.userId,
      provider: provider.name,
      amountAgorot: TOP2_PRICE_AGOROT,
    });
    const returnUrl = `${frontendUrl()}/payment-return?payment=${payment._id}`;
    const checkout = await provider.createCheckout({ payment, returnUrl, cancelUrl: `${frontendUrl()}/ai-counselor` });

    if (checkout.confirmNow) await confirmPayment(payment._id, checkout.confirmNow);
    else await Payment.updateOne({ _id: payment._id }, { processId: checkout.processId, processToken: checkout.processToken });

    res.json({ url: checkout.url, paymentId: String(payment._id) });
  } catch (err) {
    return sendServerError(res, err, "[payments/checkout]");
  }
}

/** GET /api/payments/top-matches/status → { unlocked, priceIls, paywall } for the return page and cards. */
export async function getTopMatchesStatus(req, res) {
  try {
    res.json({
      paywall: isPaywallEnabled(),
      unlocked: await isTopUnlocked(req.userId),
      priceIls: TOP2_PRICE_AGOROT / 100,
    });
  } catch (err) {
    return sendServerError(res, err, "[payments/status]");
  }
}
