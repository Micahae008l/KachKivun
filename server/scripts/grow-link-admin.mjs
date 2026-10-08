import "../env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import PaymentOrder from "../models/PaymentOrder.js";
import User from "../models/User.js";
import {
  AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  getPaymentProduct,
} from "../services/payments/catalog.js";
import { finalizePaid, finalizeRefund } from "../services/payments/paymentPersistence.js";
import { createOpaqueSecret, hashPaymentSecret } from "../services/payments/secrets.js";

const USAGE = `Manual operations for PAYMENTS_PROVIDER=grow_link.

  node scripts/grow-link-admin.mjs grant <account-email> <grow-transaction-id>
      Unlock an account for a Grow payment the webhook could not match.

  node scripts/grow-link-admin.mjs refunded <order-id>
      After refunding the transaction in the Grow dashboard, close the order
      and revoke the unlock.`;

async function grant(email, transactionId) {
  if (!email || !transactionId) throw new Error(USAGE);
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("_id").lean();
  if (!user) throw new Error(`No account with email ${email}`);
  const existing = await PaymentOrder.findOne({ providerTransactionId: transactionId }).lean();
  if (existing) throw new Error(`Transaction already belongs to order ${existing.publicId}`);

  const product = getPaymentProduct(AI_COUNSELOR_TOP_TWO_PRODUCT_KEY);
  const order = await PaymentOrder.create({
    userId: user._id,
    productKey: product.productKey,
    amountMinor: product.amountMinor,
    currency: product.currency,
    provider: "grow_link",
    status: "pending",
    callbackSecretHash: hashPaymentSecret(createOpaqueSecret()),
    returnSecretHash: hashPaymentSecret(createOpaqueSecret()),
  });
  const result = await finalizePaid({
    orderId: order._id,
    evidence: { transactionId, statusCode: "2" },
  });
  console.log(`Granted: order ${result.order.publicId} is ${result.status}`);
}

async function refunded(publicId) {
  if (!publicId) throw new Error(USAGE);
  const order = await PaymentOrder.findOne({ publicId, provider: "grow_link" });
  if (!order) throw new Error(`No grow_link order ${publicId}`);
  const result = await finalizeRefund({
    orderId: order._id,
    refundTransactionId: `manual-${order.providerTransactionId}`,
    providerStatus: "manual_refund",
  });
  console.log(`Order ${publicId} is ${result.status}; unlock revoked.`);
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "grant" && command !== "refunded") throw new Error(USAGE);
  await connectDB();
  if (command === "grant") await grant(...args);
  else await refunded(...args);
}

run()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
