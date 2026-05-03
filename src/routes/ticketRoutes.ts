import { Router } from "express";
import * as ticketController from "../controllers/ticketController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  bookTicketSchema,
  validateCheckInSchema,
  syncTicketsSchema,
} from "../validation/ticketValidation.js";

const router = Router();

//Initialize Booking (Starts the booking flow)
router.post(
  "/book",
  optionalProtect,
  validate(bookTicketSchema),
  ticketController.initializeBooking,
);

router.get("/verify/:reference", ticketController.verifyTicketPayment);

router.get("/:id", protect, ticketController.getTicketDetails);

router.get(
  "/event/:eventId/sync",
  protect,
  validate(syncTicketsSchema),
  ticketController.syncTickets,
);

router.post(
  "/check-in/:eventId",
  protect,
  validate(validateCheckInSchema),
  ticketController.validateCheckIn,
);

export default router;
