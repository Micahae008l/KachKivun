import { Router } from "express";
import { getGibushContent } from "../controllers/gibushController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GIBUSH_FREE=1 (local server/.env only): open to guests too, for testing.
const auth = process.env.GIBUSH_FREE === "1" ? (_req, _res, next) => next() : authenticateToken;
router.get("/content", auth, getGibushContent);

export default router;
