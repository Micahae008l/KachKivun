import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { enforceTokenCap } from "../middleware/enforceTokenCap.js";
import { matchRoles } from "../controllers/aiController.js";
import {
  listMatchHistory,
  getMatchHistory,
  deleteMatchHistory,
} from "../controllers/matchHistoryController.js";

const router = Router();

router.get("/match-history", authenticateToken, listMatchHistory);
router.get("/match-history/:id", authenticateToken, getMatchHistory);
router.delete("/match-history/:id", authenticateToken, deleteMatchHistory);
router.post("/match-roles", authenticateToken, enforceTokenCap, matchRoles);

export default router;
