import { Router } from "express";
import { recordFunnelStep } from "../controllers/metricsController.js";

const router = Router();

// Anonymous step counter, no auth and no identifiers; the shared /api rate limit applies.
router.post("/funnel", recordFunnelStep);

export default router;
