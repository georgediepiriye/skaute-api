import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

// PROTECT ALL ROUTES BELOW
router.use(protect);
router.use(restrictTo("admin"));

router.get("/events", adminController.getModerationQueue);

router.get("/events/:id", adminController.getEventPreview);

router.patch("/events/:id/status", adminController.processApproval);
router.get("/users", adminController.getAllUsers);
router.get("/pulse", adminController.getPulseAnalytics);
router.get("/events/manage/:id", adminController.getEventManagementData);

export default router;
