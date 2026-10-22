import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  cancelOrder,
  checkout,
  checkoutShare,
  claimPayment,
  createShare,
  getOffer,
  getOrderStatus,
  getReturnStatus,
  getShare,
  listOrders,
  mockConfirm,
  mockConfirmReturn,
  refundOrder,
} from "../controllers/paymentsController.js";
import { redeemPromo } from "../controllers/promoCodesController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePaymentsEnabled } from "../middleware/paymentsEnabled.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  validateCancellationRequest,
  validateCheckout,
  validateParentShare,
  validateRefundRequest,
  validateShareCheckout,
} from "../validators/payments.js";

const router = Router();

// Claims are looked up by email or phone, so keep guessing slow.
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.", code: "RATE_LIMIT_CLAIM" },
});

router.get("/offer", getOffer);
router.post(
  "/checkout",
  requirePaymentsEnabled,
  authenticateToken,
  validateRequest(validateCheckout),
  checkout,
);
router.post(
  "/parent-share",
  requirePaymentsEnabled,
  authenticateToken,
  validateRequest(validateParentShare),
  createShare,
);
router.get("/share/:shareToken", getShare);
router.post(
  "/share/:shareToken/checkout",
  requirePaymentsEnabled,
  validateRequest(validateShareCheckout),
  checkoutShare,
);
router.post("/claim", authenticateToken, claimLimiter, claimPayment);
// Same slow limiter as claims: codes are short, so guessing has to be expensive.
router.post("/redeem", authenticateToken, claimLimiter, redeemPromo);
router.get("/orders", authenticateToken, listOrders);
router.get("/orders/:publicId", authenticateToken, getOrderStatus);
router.get("/return/:publicId/:returnToken", getReturnStatus);
router.post("/return/:publicId/:returnToken/mock-confirm", mockConfirmReturn);
router.post(
  "/orders/:publicId/cancel",
  authenticateToken,
  validateRequest(validateCancellationRequest),
  cancelOrder,
);
router.post(
  "/orders/:publicId/refund",
  authenticateToken,
  validateRequest(validateRefundRequest),
  refundOrder,
);
router.post("/orders/:publicId/mock-confirm", authenticateToken, mockConfirm);

export default router;
