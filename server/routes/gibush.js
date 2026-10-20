import { Router } from "express";
import { getGibushContent } from "../controllers/gibushController.js";

const router = Router();

// Free and public: the simulation is open to everyone, logged in or not.
router.get("/content", getGibushContent);

export default router;
