import { Router } from "express";
import * as eventController from "../controllers/eventController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createEventSchema,
  eventIdParamSchema,
  addCoOrganizerSchema,
  removeCoOrganizerSchema,
} from "../validation/eventValidation.js";

const router = Router();

// --- PUBLIC ROUTES ---
router.get("/", eventController.getAllEvents);
router.get("/nearby", eventController.getNearbyEvents);
router.get("/:id", eventController.getEvent);

// --- PROTECTED ROUTES GATE ---
// Everything below this line now requires a valid login cookie
router.use(protect);

router.post("/", validate(createEventSchema), eventController.createEvent);
router.get(
  "/:id/manage",
  validate(eventIdParamSchema),
  eventController.getManagementDashboardData,
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

// router.patch("/:id", eventController.updateEvent);
// router.delete("/:id", eventController.deleteEvent);

export default router;
