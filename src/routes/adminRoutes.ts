// routes/adminRoutes.ts

import { Router } from "express";
import * as adminController from "../controllers/adminController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

import {
  processApprovalSchema,
  updateEventPromotionSchema,
  toggleUserStatusSchema,
  toggleUserVerificationSchema,
  completeManualPayoutSchema,
  adminEventIdParamSchema,
  adminTelemetryEventParamSchema,
} from "../validation/adminValidation.js";

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));

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
  validate(processApprovalSchema),
  adminController.processApproval,
);

router.patch(
  "/events/:id/promotion",
  validate(updateEventPromotionSchema),
  adminController.updateEventPromotion,
);

// -----------------------------------
// USER MANAGEMENT
// -----------------------------------

router.get("/users", adminController.getAllUsers);

router.patch(
  "/users/:id/status",
  validate(toggleUserStatusSchema),
  adminController.toggleUserStatus,
);

router.patch(
  "/users/:id/verify",
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
