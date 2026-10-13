import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken } from "../middleware/auth.js";
import { enforceTokenCap } from "../middleware/enforceTokenCap.js";
import { matchRoles } from "../controllers/aiController.js";
import {
  listMatchHistory,
  getMatchHistory,
  deleteMatchHistory,
} from "../controllers/matchHistoryController.js";

import { getMatchExtras } from "../controllers/matchExtrasController.js";
import { getResultFeedback, saveResultFeedback } from "../controllers/resultFeedbackController.js";

const router = Router();

// A rating is a few clicks; this only stops someone from flooding the owner's Slack.
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.", code: "RATE_LIMIT_FEEDBACK" },
});

router.get("/match-history", authenticateToken, listMatchHistory);
router.get("/match-history/:id", authenticateToken, getMatchHistory);
router.delete("/match-history/:id", authenticateToken, deleteMatchHistory);
router.get("/match-extras", authenticateToken, getMatchExtras);
router.get("/result-feedback", authenticateToken, getResultFeedback);
router.post("/result-feedback", authenticateToken, feedbackLimiter, saveResultFeedback);
router.post("/match-roles", authenticateToken, enforceTokenCap, matchRoles);

export default router;
