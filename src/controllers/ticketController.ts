import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Ticket } from "../models/Ticket.js";
import AppError from "../utils/AppError.js";
import * as ticketService from "./services/ticketService.js";
import { Order } from "../models/Order.js";
import {
  SyncTicketsParams,
  SyncTicketsQuery,
} from "../validation/ticketValidation.js";

/**
 * @desc    Initialize a ticket booking
 * @route   POST /v1/tickets/book
 * @access  Public
 */
export const initializeBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      eventId,
      tierName,
      quantity,
      email,
      firstName,
      lastName,
      discountCode,
    } = req.body;
    const userId = (req.user as any)?.id?.toString() || null;
    console.log("RESOLVED ACCOUNT ID:", userId);

    const result = await ticketService.processBooking(
      userId,
      email,
      eventId,
      tierName,
      quantity,
      { firstName, lastName },
      discountCode,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyTicketPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { reference } = req.params;

    const result = await ticketService.verifyAndFulfillOrder(
      reference as string,
    );

    if (result.status === "success") {
      return res.status(httpStatus.OK).json({
        status: "success",
        message: "Payment confirmed!",
        data: {
          order: result.order,
          tickets: result.tickets,
        },
      });
    }

    // Return the pending state
    res.status(httpStatus.OK).json({
      status: "pending",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single ticket details for the QR page
 * @route   GET /v1/tickets/:id
 * @access  Private (Owner or Staff)
 */
export const getTicketDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(id as string);

    if (!ticket) {
      return next(new AppError("Ticket not found", httpStatus.NOT_FOUND));
    }

    // SECURITY: Ensure the person asking is the owner or Kivo staff
    const userId = (req.user as any)?.id?.toString();
    const userRole = (req.user as any)?.role;
    const isStaff = ["admin", "staff", "organizer"].includes(userRole);

    if (ticket.owner?.toString() !== userId && !isStaff) {
      return next(
        new AppError(
          "You do not have permission to view this ticket",
          httpStatus.FORBIDDEN,
        ),
      );
    }

    res.status(httpStatus.OK).json({
      status: "success",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process live check-in via QR scan
 * @route   POST /v1/tickets/check-in/:eventId
 * @access  Private (Organizer/Staff)
 */
export const validateCheckIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { checkInCode } = req.body;
    const { eventId } = req.params;
    const scannerId = (req as any).user.id;

    const checkInData = await ticketService.processTicketCheckIn(
      checkInCode,
      eventId as string,
      scannerId,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Check-in successful!",
      data: checkInData,
    });
  } catch (error: any) {
    // Error is caught here and passed to your global error handler
    // If it's a 409 or 404 from our service, it will have the correct status code
    next(error);
  }
};

export const syncTickets = async (
  req: Request<SyncTicketsParams, any, any, SyncTicketsQuery>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { eventId } = req.params;
    const { since } = req.query;

    const syncDate = new Date(Number(since));

    const tickets = await Ticket.find({
      event: eventId,
      updatedAt: { $gt: syncDate },
    })
      .select("buyerInfo tierName status checkInCode updatedAt")
      .lean();

    res.status(httpStatus.OK).json({
      status: "success",
      count: tickets.length,
      serverTime: Date.now(),
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

// controllers/ticketController.ts

export const refundTicket = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ticketCode } = req.params;

    // Authorization check: Only organizers or admins should refund
    const userRole = (req.user as any)?.role;
    if (!["admin", "organizer"].includes(userRole)) {
      throw new AppError("Unauthorized to issue refunds", httpStatus.FORBIDDEN);
    }

    const result = await ticketService.processTicketRefund(
      ticketCode as string,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Ticket invalidated and inventory updated",
      data: result.ticket,
    });
  } catch (error) {
    next(error);
  }
};
