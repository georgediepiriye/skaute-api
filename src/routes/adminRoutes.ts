import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));

router.get("/events", adminController.getModerationQueue);
router.get("/events/:id", adminController.getEventPreview);
router.patch("/events/:id/status", adminController.processApproval);

// Dedicated promotional & curation control endpoint
router.patch("/events/:id/promotion", adminController.updateEventPromotion);

// --- USER MANAGEMENT ENDPOINTS ---
router.get("/users", adminController.getAllUsers);
router.patch("/users/:id/status", adminController.toggleUserStatus);
router.patch("/users/:id/verify", adminController.toggleUserVerification);

router.get("/pulse", adminController.getPulseAnalytics);
router.get("/events/manage/:id", adminController.getEventManagementData);

// --- PAYOUT & SETTLEMENT MANAGEMENT ENDPOINTS ---
router.get("/payouts", adminController.getPayoutQueue);
router.patch("/payouts/:id/complete", adminController.completeManualPayout);

// --- TELEMETRY MANAGEMENT ENDPOINTS ---
router.get("/telemetry/global", adminController.getGlobalTelemetry);
router.get("/telemetry/events/:eventId", adminController.getEventTelemetry);

export default router;
