import { Router } from "express";
import {
  cancelOrder,
  checkout,
  checkoutShare,
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
