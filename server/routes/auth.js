import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateRequestOtp, validateVerifyOtp } from "../validators/auth.js";
import {
  getSession,
  login,
  logout,
  refreshSession,
  register,
  restorePaymentReturnSession,
  requestOtp,
  verifyOtp,
} from "../controllers/authController.js";

const router = Router();

router.get("/me", authenticateToken, getSession);
router.post("/refresh", refreshSession);
router.post("/logout", logout);
router.post("/payment-return-session", authLimiter, restorePaymentReturnSession);
router.post("/request-otp", authLimiter, validateRequest(validateRequestOtp), requestOtp);
router.post("/verify-otp", authLimiter, validateRequest(validateVerifyOtp), verifyOtp);
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

export default router;
