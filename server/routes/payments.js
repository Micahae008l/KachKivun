import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getTopMatchesStatus, startTopMatchesCheckout } from "../controllers/paymentsController.js";

const router = Router();

router.post("/top-matches/checkout", authenticateToken, startTopMatchesCheckout);
router.get("/top-matches/status", authenticateToken, getTopMatchesStatus);

export default router;
