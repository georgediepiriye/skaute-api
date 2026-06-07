import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Ticket } from "../models/Ticket.js";
import AppError from "../utils/AppError.js";
import * as ticketService from "./services/ticketService.js";

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
      eventTitle,
    } = req.body;
    const userId = (req.user as any)?.id?.toString() || null;

    const result = await ticketService.processBooking(
      userId,
      email,
      eventId,
      tierName,
      quantity,
      { firstName, lastName },
      discountCode,
      eventTitle,
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
      return next(new AppError(httpStatus.NOT_FOUND, "Ticket not found"));
    }

    // SECURITY: Ensure the person asking is the owner or skaute staff
    const userId = (req.user as any)?.id?.toString();
    const userRole = (req.user as any)?.role;
    const isStaff = ["admin", "staff", "organizer"].includes(userRole);

    if (ticket.owner?.toString() !== userId && !isStaff) {
      return next(
        new AppError(
          httpStatus.FORBIDDEN,
          "You do not have permission to view this ticket",
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
    const { checkInCode, deviceFingerprint, offlineTimestamp } = req.body;
    const { eventId } = req.params;
    const scannerId = (req as any).user.id;

    // Fallback context validation check to catch device telemetry from headers if necessary
    const activeDeviceFingerprint =
      deviceFingerprint || (req.headers["x-device-fingerprint"] as string);

    const checkInData = await ticketService.processTicketCheckIn(
      checkInCode,
      eventId as string,
      scannerId,
      activeDeviceFingerprint,
      offlineTimestamp,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Check-in successful!",
      data: checkInData,
    });
  } catch (error: any) {
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
      throw new AppError(httpStatus.FORBIDDEN, "Unauthorized to issue refunds");
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

export const manualCheckIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ticketCode } = req.params as { ticketCode: string };
    const staffId = (req.user as any)._id;

    const result = await ticketService.processManualCheckIn(
      ticketCode,
      staffId,
    );

    res.status(httpStatus.OK).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const resendTicket = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ticketCode } = req.params as { ticketCode: string };
    await ticketService.processResendTicket(ticketCode);

    res
      .status(httpStatus.OK)
      .json({ status: "success", message: "Ticket re-sent successfully" });
  } catch (error) {
    next(error);
  }
};

export const transferTicket = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ticketCode } = req.params;
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "New buyer details are required",
      );
    }

    const updatedTicket = await ticketService.processTicketTransfer(
      ticketCode as string,
      {
        firstName,
        lastName,
        email,
      },
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Ticket transferred successfully",
      data: updatedTicket,
    });
  } catch (error) {
    next(error);
  }
};
