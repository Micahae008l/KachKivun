import mongoose from "mongoose";
import Entitlement from "../../models/Entitlement.js";
import PaymentOrder from "../../models/PaymentOrder.js";
import { PaymentError } from "./errors.js";
import { hashPaymentSecret } from "./secrets.js";

export const PAYMENT_PRIVATE_SELECT = [
  "+callbackSecretHash",
  "+returnSecretHash",
  "+shareTokenHash",
  "+checkoutUrl",
  "+providerProcessToken",
  "+providerProcessTokenHash",
  "+growPageCode",
  "+growProcessToken",
  "+growProcessTokenHash",
  "+growTransactionToken",
  "+growTransactionTokenHash",
].join(" ");

export function findPrivateOrderByPublicId(publicId, extraFilter = {}) {
  return PaymentOrder.findOne({ publicId, ...extraFilter }).select(PAYMENT_PRIVATE_SELECT);
}

export function findPrivateOrderByShareHash(shareTokenHash) {
  return PaymentOrder.findOne({ shareTokenHash }).select(PAYMENT_PRIVATE_SELECT);
}

export async function findTransactionOwner(transactionId, excludedOrderId) {
  if (!transactionId) return null;
  return PaymentOrder.findOne({
    _id: { $ne: excludedOrderId },
    $or: [{ providerTransactionId: transactionId }, { growTransactionId: transactionId }],
  })
    .select("_id publicId status")
    .lean();
}

export function buildEntitlementGrantOperation(order, evidence, now = new Date()) {
  return {
    filter: { userId: order.userId, productKey: order.productKey },
    update: {
      $set: {
        status: "active",
        startsAt: now,
        expiresAt: null,
        source: "payment",
        sourceOrderId: order._id,
        sourcePaymentProvider: order.provider,
        sourceTransactionId: evidence.transactionId,
        sourcePaidAt: now,
        revokedAt: null,
        revokedReason: "",
        revokedByOrderId: null,
        refundedAt: null,
        refundTransactionId: null,
      },
      $setOnInsert: {
        userId: order.userId,
        productKey: order.productKey,
      },
    },
  };
}

export function buildEntitlementRefundOperation(order, refundTransactionId, now = new Date()) {
  return {
    filter: {
      userId: order.userId,
      productKey: order.productKey,
      sourceOrderId: order._id,
      sourceTransactionId: order.providerTransactionId,
      status: { $in: ["active", "grandfathered"] },
    },
    update: {
      $set: {
        status: "revoked",
        revokedAt: now,
        revokedReason: "payment_refunded",
        revokedByOrderId: order._id,
        refundedAt: now,
        refundTransactionId,
      },
    },
  };
}

export async function finalizePaid({ orderId, evidence, now = new Date() }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await PaymentOrder.findById(orderId)
        .select(PAYMENT_PRIVATE_SELECT)
        .session(session);
      if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", undefined, 404);

      if (["refund_requested", "refunded"].includes(order.status)) {
        result = { status: order.status, duplicate: true, order };
        return;
      }
      if (order.status === "paid") {
        const sameTransaction =
          order.providerTransactionId === evidence.transactionId ||
          order.growTransactionId === evidence.transactionId;
        if (!sameTransaction) {
          throw new PaymentError("PAYMENT_TRANSACTION_MISMATCH", undefined, 409);
        }
        result = { status: "paid", duplicate: true, order };
        return;
      }

      const duplicate = await PaymentOrder.exists({
        _id: { $ne: order._id },
        $or: [
          { providerTransactionId: evidence.transactionId },
          { growTransactionId: evidence.transactionId },
        ],
      }).session(session);
      if (duplicate) {
        throw new PaymentError("PAYMENT_TRANSACTION_DUPLICATE", undefined, 409);
      }

      const set = {
        status: "paid",
        openOrderKey: null,
        providerTransactionId: evidence.transactionId,
        providerStatusCode: evidence.statusCode,
        inquiryConfirmedAt: now,
        approvedAt: now,
        paidAt: now,
        failedAt: null,
        sanitizedError: null,
      };
      if (order.provider === "grow") {
        set.growTransactionId = evidence.transactionId;
        set.growTransactionToken = evidence.transactionToken;
        set.growTransactionTokenHash = hashPaymentSecret(evidence.transactionToken);
      }

      const updated = await PaymentOrder.findOneAndUpdate(
        {
          _id: order._id,
          status: { $in: ["created", "pending", "processing", "failed", "expired"] },
          $or: [{ providerTransactionId: null }, { providerTransactionId: evidence.transactionId }],
        },
        { $set: set },
        { new: true, session, runValidators: true },
      );
      if (!updated) {
        throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);
      }

      const entitlement = buildEntitlementGrantOperation(order, evidence, now);
      await Entitlement.findOneAndUpdate(entitlement.filter, entitlement.update, {
        upsert: true,
        new: true,
        session,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
      result = { status: "paid", duplicate: false, order: updated };
    });
    return result;
  } catch (error) {
    if (error?.code === 11000) {
      throw new PaymentError("PAYMENT_TRANSACTION_DUPLICATE", undefined, 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function finalizeRefund({
  orderId,
  refundTransactionId,
  providerStatus,
  now = new Date(),
}) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await PaymentOrder.findById(orderId).session(session);
      if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", undefined, 404);
      if (order.status === "refunded") {
        result = { status: "refunded", duplicate: true, order };
        return;
      }
      if (!["paid", "refund_requested"].includes(order.status)) {
        throw new PaymentError("PAYMENT_REFUND_STATE_INVALID", undefined, 409);
      }

      const updated = await PaymentOrder.findOneAndUpdate(
        { _id: order._id, status: { $in: ["paid", "refund_requested"] } },
        {
          $set: {
            status: "refunded",
            openOrderKey: null,
            refundTransactionId,
            refundProviderStatus: providerStatus,
            refundedAt: now,
            sanitizedError: null,
          },
        },
        { new: true, session, runValidators: true },
      );
      if (!updated) throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);

      const entitlement = buildEntitlementRefundOperation(order, refundTransactionId, now);
      await Entitlement.findOneAndUpdate(entitlement.filter, entitlement.update, {
        new: true,
        session,
        runValidators: true,
      });
      result = { status: "refunded", duplicate: false, order: updated };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export const paymentPersistence = Object.freeze({
  findTransactionOwner,
  finalizePaid,
  finalizeRefund,
});
