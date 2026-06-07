import { Router } from "express";
import * as ticketController from "../controllers/ticketController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  bookTicketSchema,
  validateCheckInSchema,
  syncTicketsSchema,
  refundTicketSchema,
  transferTicketSchema,
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

router.post(
  "/refund/:ticketCode",
  protect,
  validate(refundTicketSchema),
  ticketController.refundTicket,
);
router.patch("/checkin/:ticketCode", protect, ticketController.manualCheckIn);
router.post("/resend/:ticketCode", protect, ticketController.resendTicket);
router.patch(
  "/transfer/:ticketCode",
  protect,
  validate(transferTicketSchema),
  ticketController.transferTicket,
);

export default router;
