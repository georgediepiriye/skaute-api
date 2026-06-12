// routes/adminRoutes.ts

import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import * as hotspotController from "../controllers/hotspotController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

import {
  bulkTicketIssueSchema,
  processApprovalSchema,
  updateEventPromotionSchema,
  toggleUserStatusSchema,
  toggleUserVerificationSchema,
  completeManualPayoutSchema,
  adminEventIdParamSchema,
  adminTelemetryEventParamSchema,
  adminHotspotSuggestionIdSchema,
  rejectHotspotSuggestionSchema,
  updateHotspotSuggestionSchema,
} from "../validation/adminValidation.js";
import { updateHotspotSchema } from "../validation/hotspotValidation.js";
import { adminLimiter, adminWriteLimiter } from "../utils/rateLimitter.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));
router.use(adminLimiter);

// -----------------------------------
// EVENT MODERATION
// -----------------------------------

router.get("/events", adminController.getModerationQueue);

router.get(
  "/events/:id",
  validate(adminEventIdParamSchema),
  adminController.getEventPreview,
);

router.patch(
  "/events/:id/status",
  adminWriteLimiter,
  validate(processApprovalSchema),
  adminController.processApproval,
);

router.patch(
  "/events/:id/promotion",
  adminWriteLimiter,
  validate(updateEventPromotionSchema),
  adminController.updateEventPromotion,
);

router.post(
  "/events/:id/tickets/bulk",
  adminWriteLimiter,
  validate(bulkTicketIssueSchema),
  adminController.issueBulkTickets,
);

// -----------------------------------
// HOTSPOT MANAGEMENT
// -----------------------------------

router.get("/hotspots", adminController.getAllHotspots);
router.patch(
  "/hotspots/:hotspotId",
  adminWriteLimiter,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  validate(updateHotspotSchema),
  hotspotController.updateHotspot,
);

router.get("/hotspot-suggestions", adminController.getHotspotSuggestions);
router.get(
  "/hotspot-suggestions/:id",
  validate(adminHotspotSuggestionIdSchema),
  adminController.getHotspotSuggestion,
);
router.patch(
  "/hotspot-suggestions/:id",
  adminWriteLimiter,
  validate(updateHotspotSuggestionSchema),
  adminController.updateHotspotSuggestion,
);
router.post(
  "/hotspot-suggestions/:id/approve",
  adminWriteLimiter,
  validate(adminHotspotSuggestionIdSchema),
  adminController.approveHotspotSuggestion,
);
router.post(
  "/hotspot-suggestions/:id/reject",
  adminWriteLimiter,
  validate(rejectHotspotSuggestionSchema),
  adminController.rejectHotspotSuggestion,
);
router.delete(
  "/hotspot-suggestions/:id",
  adminWriteLimiter,
  validate(adminHotspotSuggestionIdSchema),
  adminController.deleteHotspotSuggestion,
);

// -----------------------------------
// USER MANAGEMENT
// -----------------------------------

router.get("/users", adminController.getAllUsers);

router.patch(
  "/users/:id/status",
  adminWriteLimiter,
  validate(toggleUserStatusSchema),
  adminController.toggleUserStatus,
);

router.patch(
  "/users/:id/verify",
  adminWriteLimiter,
  validate(toggleUserVerificationSchema),
  adminController.toggleUserVerification,
);

// -----------------------------------
// ANALYTICS
// -----------------------------------

router.get("/pulse", adminController.getPulseAnalytics);

router.get(
  "/events/manage/:id",
  validate(adminEventIdParamSchema),
  adminController.getEventManagementData,
);

// -----------------------------------
// PAYOUTS
// -----------------------------------

router.get("/payouts", adminController.getPayoutQueue);

router.patch(
  "/payouts/:id/complete",
  adminWriteLimiter,
  validate(completeManualPayoutSchema),
  adminController.completeManualPayout,
);

// -----------------------------------
// TELEMETRY
// -----------------------------------

router.get("/telemetry/global", adminController.getGlobalTelemetry);

router.get(
  "/telemetry/events/:eventId",
  validate(adminTelemetryEventParamSchema),
  adminController.getEventTelemetry,
);

export default router;
