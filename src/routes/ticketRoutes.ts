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
import {
  paymentLimiter,
  ticketActionLimiter,
  ticketScanLimiter,
} from "../utils/rateLimitter.js";

const router = Router();

//Initialize Booking (Starts the booking flow)
router.post(
  "/book",
  paymentLimiter,
  optionalProtect,
  validate(bookTicketSchema),
  ticketController.initializeBooking,
);

router.get(
  "/verify/:reference",
  paymentLimiter,
  ticketController.verifyTicketPayment,
);

router.get("/:id", protect, ticketController.getTicketDetails);

router.get(
  "/event/:eventId/sync",
  protect,
  validate(syncTicketsSchema),
  ticketController.syncTickets,
);

router.post(
  "/check-in/:eventId",
  ticketScanLimiter,
  protect,
  validate(validateCheckInSchema),
  ticketController.validateCheckIn,
);

router.post(
  "/refund/:ticketCode",
  ticketActionLimiter,
  protect,
  validate(refundTicketSchema),
  ticketController.refundTicket,
);
router.patch(
  "/checkin/:ticketCode",
  ticketScanLimiter,
  protect,
  ticketController.manualCheckIn,
);
router.post(
  "/resend/:ticketCode",
  ticketActionLimiter,
  protect,
  ticketController.resendTicket,
);
router.patch(
  "/transfer/:ticketCode",
  ticketActionLimiter,
  protect,
  validate(transferTicketSchema),
  ticketController.transferTicket,
);

export default router;
