import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));

router.get("/events", adminController.getModerationQueue);
router.get("/events/:id", adminController.getEventPreview);
router.patch("/events/:id/status", adminController.processApproval);

// --- USER MANAGEMENT ENDPOINTS ---
router.get("/users", adminController.getAllUsers);
router.patch("/users/:id/status", adminController.toggleUserStatus);
router.patch("/users/:id/verify", adminController.toggleUserVerification);

router.get("/pulse", adminController.getPulseAnalytics);
router.get("/events/manage/:id", adminController.getEventManagementData);

export default router;
