import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateProfileUpdate } from "../validators/profile.js";
import {
  deleteAccount,
  recordAttribution,
  setMarketingConsent,
  updateProfile,
} from "../controllers/profileController.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.put("/update", authenticateToken, validateRequest(validateProfileUpdate), updateProfile);

router.delete("/account", authenticateToken, authLimiter, deleteAccount);

// Sent once per browser after sign-in; first known source wins, later calls change nothing.
router.post("/attribution", authenticateToken, recordAttribution);

// Marketing email opt-in / opt-out, from the signup checkbox or the dashboard toggle.
router.put("/marketing-consent", authenticateToken, authLimiter, setMarketingConsent);

export default router;
