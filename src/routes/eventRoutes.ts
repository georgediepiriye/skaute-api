import { Router } from "express";
import * as eventController from "../controllers/eventController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createEventSchema,
  eventIdParamSchema,
  addCoOrganizerSchema,
  removeCoOrganizerSchema,
  updateEventSchema,
  createDiscountValidation,
  deleteDiscountValidation,
  validateDiscountValidation,
  updateCoOrganizerPermissionsValidation,
  issueManualTicketValidation,
} from "../validation/eventValidation.js";
import {
  discountLimiter,
  eventViewLimiter,
  ticketActionLimiter,
  uploadLimiter,
  writeLimiter,
} from "../utils/rateLimitter.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// --- PUBLIC ROUTES ---
router.get("/", eventController.getAllEvents);
router.get("/nearby", eventController.getNearbyEvents);
router.get("/:id", eventController.getEvent);
router.get("/slug/:slug", eventController.getEventBySlug);
router.get("/count-active", eventController.getActiveMovesCount);
router.post(
  "/:id/view",
  eventViewLimiter,
  validate(eventIdParamSchema),
  eventController.recordEventView,
);
router.post(
  "/:id/discounts/validate",
  discountLimiter,
  validate(validateDiscountValidation),
  eventController.validateDiscountCode,
);

// --- PROTECTED ROUTES GATE ---
// Everything below this line now requires a valid login cookie
router.use(protect);

router.post(
  "/",
  uploadLimiter,
  upload.single("image"),
  validate(createEventSchema),
  eventController.createEvent,
);
router.patch("/:id", writeLimiter, validate(updateEventSchema), eventController.updateEvent);
router.get(
  "/:id/manage",
  validate(eventIdParamSchema),
  eventController.getManagementDashboardData,
);

router.get("/:eventId/broadcasts", eventController.getEventBroadcasts);
router.post(
  "/:eventId/broadcasts",
  writeLimiter,
  eventController.createEventBroadcast,
);
router.get("/:eventId/audit-logs", eventController.getEventAuditLogs);
router.patch(
  "/:eventId/gate-incidents/:incidentId/resolve",
  writeLimiter,
  eventController.resolveGateIncident,
);
router.patch(
  "/:eventId/scanner-devices/:deviceId",
  writeLimiter,
  eventController.updateScannerDevice,
);
router.delete(
  "/:eventId/scanner-devices/:deviceId",
  writeLimiter,
  eventController.revokeScannerDevice,
);
router.get("/:eventId/refunds", eventController.getEventRefunds);
router.patch(
  "/:eventId/refunds/:refundId/approve",
  writeLimiter,
  eventController.approveEventRefund,
);
router.patch(
  "/:eventId/refunds/:refundId/reject",
  writeLimiter,
  eventController.rejectEventRefund,
);
router.get("/:eventId/post-event-report", eventController.getPostEventReport);

router.post(
  "/:id/tickets/issue-manual",
  ticketActionLimiter,
  validate(issueManualTicketValidation),
  eventController.issueManualTicket,
);

router.patch(
  "/:eventId/co-organizers",
  writeLimiter,
  validate(addCoOrganizerSchema),
  eventController.addCoOrganizer,
);

router.delete(
  "/:eventId/co-organizers/:partnerId",
  writeLimiter,
  validate(removeCoOrganizerSchema),
  eventController.removeCoOrganizer,
);

router.patch(
  "/:id/update-coorganizer-permissions",
  writeLimiter,
  validate(updateCoOrganizerPermissionsValidation),
  eventController.updateCoOrganizerPermissions,
);

// --- DISCOUNT ROUTES ---
router.patch(
  "/:id/discounts",
  writeLimiter,
  validate(createDiscountValidation),
  eventController.createDiscountCode,
);

router.delete(
  "/:id/discounts/:discountId",
  writeLimiter,
  validate(deleteDiscountValidation),
  eventController.deleteDiscountCode,
);

router.patch("/:id/toggle-sold-out", writeLimiter, eventController.toggleSoldOutStatus);
router.get("/:eventId/gate-control", eventController.getGateControlTelemetry);

router.patch(
  "/:id/cancel",
  writeLimiter,
  validate(eventIdParamSchema),
  eventController.cancelEvent,
);

router.delete(
  "/:id",
  writeLimiter,
  validate(eventIdParamSchema),
  eventController.deleteEvent,
);

export default router;
