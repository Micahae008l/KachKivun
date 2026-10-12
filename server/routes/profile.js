import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateProfileUpdate } from "../validators/profile.js";
import { deleteAccount, updateProfile } from "../controllers/profileController.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.put("/update", authenticateToken, validateRequest(validateProfileUpdate), updateProfile);

router.delete("/account", authenticateToken, authLimiter, deleteAccount);

export default router;
