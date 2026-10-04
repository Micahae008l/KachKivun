import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { enforceTokenCap } from "../middleware/enforceTokenCap.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateFitnessBody, validateReportPdfBody } from "../validators/ai.js";
import { requireTopUnlocked } from "../utils/topMatchLock.js";
import { matchRoles } from "../controllers/aiController.js";
import { generateReport, downloadReportPdf } from "../controllers/reportController.js";
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
router.post(
  "/full-report",
  authenticateToken,
  requireTopUnlocked,
  enforceTokenCap,
  validateRequest(validateFitnessBody),
  generateReport,
);
router.post("/report-pdf", authenticateToken, requireTopUnlocked, validateRequest(validateReportPdfBody), downloadReportPdf);

export default router;
