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
  validate(eventIdParamSchema),
  eventController.recordEventView,
);
router.post(
  "/:id/discounts/validate",
  validate(validateDiscountValidation),
  eventController.validateDiscountCode,
);

// --- PROTECTED ROUTES GATE ---
// Everything below this line now requires a valid login cookie
router.use(protect);

router.post(
  "/",
  upload.single("image"),
  validate(createEventSchema),
  eventController.createEvent,
);
router.patch("/:id", validate(updateEventSchema), eventController.updateEvent);
router.get(
  "/:id/manage",
  validate(eventIdParamSchema),
  eventController.getManagementDashboardData,
);

router.post(
  "/:id/tickets/issue-manual",
  validate(issueManualTicketValidation),
  eventController.issueManualTicket,
);

router.patch(
  "/:eventId/co-organizers",
  validate(addCoOrganizerSchema),
  eventController.addCoOrganizer,
);

router.delete(
  "/:eventId/co-organizers/:partnerId",
  validate(removeCoOrganizerSchema),
  eventController.removeCoOrganizer,
);

router.patch(
  "/:id/update-coorganizer-permissions",
  validate(updateCoOrganizerPermissionsValidation),
  eventController.updateCoOrganizerPermissions,
);

// --- DISCOUNT ROUTES ---
router.patch(
  "/:id/discounts",
  validate(createDiscountValidation),
  eventController.createDiscountCode,
);

router.delete(
  "/:id/discounts/:discountId",
  validate(deleteDiscountValidation),
  eventController.deleteDiscountCode,
);

router.patch("/:id/toggle-sold-out", eventController.toggleSoldOutStatus);
router.get("/:eventId/gate-control", eventController.getGateControlTelemetry);

router.patch(
  "/:id/cancel",
  validate(eventIdParamSchema),
  eventController.cancelEvent,
);

router.delete(
  "/:id",
  validate(eventIdParamSchema),
  eventController.deleteEvent,
);

export default router;
