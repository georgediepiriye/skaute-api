import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import * as payoutController from "../controllers/payoutController.js";
import { payoutLimiter } from "../utils/rateLimitter.js";
const router = Router();

router.post("/request", payoutLimiter, protect, payoutController.requestPayout);

router.get("/organizer", protect, payoutController.getOrganizerPayouts);

export default router;
