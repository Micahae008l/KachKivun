import { Router } from "express";
import { getGibushContent } from "../controllers/gibushController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.get("/content", authenticateToken, getGibushContent);

export default router;
