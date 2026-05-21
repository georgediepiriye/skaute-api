import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import * as payoutController from "../controllers/payoutController.js";
const router = Router();

router.post("/request", protect, payoutController.requestPayout);

export default router;
