import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import * as payoutController from "../controllers/payoutController.js";
const router = Router();

router.post("/request", protect, payoutController.requestPayout);

router.get("/organizer", protect, payoutController.getOrganizerPayouts);

export default router;
