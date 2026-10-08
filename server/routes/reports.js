/** Retired. Do not remount: the AI counselor is the only personalized result product. */
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { validateObjectIdParam } from "../validators/admin.js";
import { validateReportHistoryListQuery } from "../validators/reports.js";
import {
  listReportHistory,
  getReportHistory,
  deleteReportHistory,
} from "../controllers/reportHistoryController.js";

const router = Router();

router.use(authenticateToken);

router.get("/", validateRequest(validateReportHistoryListQuery), listReportHistory);
router.get("/:id", validateRequest(validateObjectIdParam("id")), getReportHistory);
router.delete("/:id", validateRequest(validateObjectIdParam("id")), deleteReportHistory);

export default router;
