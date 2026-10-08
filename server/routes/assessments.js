import { Router } from "express";
import { completeAssessment, getLatestAssessment } from "../controllers/assessmentsController.js";
import { authenticateToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateAssessmentCompletion } from "../validators/assessments.js";

const router = Router();

router.get("/latest", authenticateToken, getLatestAssessment);
router.post(
  "/complete",
  authenticateToken,
  validateRequest(validateAssessmentCompletion),
  completeAssessment,
);

export default router;
