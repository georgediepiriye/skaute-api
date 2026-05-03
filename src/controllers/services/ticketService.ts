import mongoose, { ClientSession } from "mongoose";
import httpStatus from "http-status";
import { nanoid } from "nanoid";

import { Order } from "../../models/Order.js";
import { ORDER_STATUS, TICKET_STATUS } from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import AppError from "../../utils/AppError.js";
import { PaystackService } from "../../utils/paystackServices.js";
import config from "../../config/config.js";
import { Ticket } from "../../models/Ticket.js";
import logger from "../../utils/logger.js";
import kivoEvents from "../../utils/eventsEmitter.js";

const getExistingPendingOrder = async (
  email: string,
  eventId: string,
  tierName: string,
) => {
  return await Order.findOne({
    buyerEmail: email.toLowerCase(),
    event: eventId,
    tierName,
    status: ORDER_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });
};

export const lockInventory = async (
  eventId: string,
  tierName: string,
  quantity: number,
  session?: ClientSession,
): Promise<number> => {
  logger.debug(
    `Inventory Lock Attempt: Event=${eventId} Tier=${tierName} Qty=${quantity}`,
  );

  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: eventId,
      "ticketTiers.name": tierName,
      "ticketTiers.capacity": { $gte: quantity },
    },
    {
      $inc: {
        "ticketTiers.$[tier].sold": quantity,
        attendees: quantity,
      },
    },
    {
      arrayFilters: [{ "tier.name": tierName }],
      new: true,
      runValidators: true,
      session,
    },
  );

  if (!updatedEvent) {
    logger.error(
      `Inventory Lock Failed: Event ${eventId} or Tier ${tierName} not found`,
    );
    throw new AppError(
      httpStatus.NOT_FOUND,
      `Event not found or Ticket Tier "${tierName}" does not exist or is at capacity.`,
    );
  }

  const tier = updatedEvent.ticketTiers.find((t: any) => t.name === tierName);

  if (!tier) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Internal integrity error: Ticket tier vanished during update.",
    );
  }

  // Capacity Check
  if (tier.sold > tier.capacity) {
    logger.warn(
      `Sold Out Triggered: Event=${eventId} Tier=${tierName} (Sold:${tier.sold} > Cap:${tier.capacity})`,
    );
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Sold Out: ${tierName} has reached maximum capacity.`,
    );
  }

  return tier.price;
};

const createTicketsForOrder = async (
  order: any,
  buyerDetails: { firstName: string; lastName: string },
  session: mongoose.ClientSession,
) => {
  const ticketsToCreate = [];

  for (let i = 0; i < order.quantity; i++) {
    ticketsToCreate.push({
      event: order.event,
      owner: order.user,
      order: order._id,
      tierName: order.tierName,
      pricePaid: order.totalAmount / order.quantity,
      buyerInfo: {
        firstName: buyerDetails.firstName,
        lastName: buyerDetails.lastName,
        email: order.buyerEmail,
      },
      status: TICKET_STATUS.valid || "valid",
    });
  }

  const tickets = await Ticket.insertMany(ticketsToCreate, { session });
  const eventData = await Event.findById(order.event).session(session);

  return {
    tickets,
    eventImage: eventData?.image,
  };
};

export const processBooking = async (
  userId: string | null,
  userEmail: string,
  eventId: string,
  tierName: string,
  quantity: number = 1,
  buyerDetails: { firstName: string; lastName: string },
) => {
  const existingOrder = await getExistingPendingOrder(
    userEmail,
    eventId,
    tierName,
  );

  if (existingOrder) {
    logger.info(
      `Booking Idempotency: Resuming pending order ${existingOrder.paymentReference} for ${userEmail}`,
    );
    return {
      authorization_url: existingOrder.paymentUrl,
      reference: existingOrder.paymentReference,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const unitPrice = await lockInventory(eventId, tierName, quantity, session);
    const totalAmount = unitPrice * quantity;

    // --- CASE 1: FREE TICKET FLOW ---
    if (totalAmount === 0) {
      const freeReference = `FREE-${nanoid(10).toUpperCase()}`;

      const [order] = await Order.create(
        [
          {
            user: userId || undefined,
            buyerEmail: userEmail.toLowerCase(),
            event: new mongoose.Types.ObjectId(eventId),
            tierName,
            quantity,
            totalAmount: 0,
            paymentReference: freeReference,
            status: ORDER_STATUS.COMPLETED,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        ],
        { session },
      );

      const { tickets, eventImage } = await createTicketsForOrder(
        order,
        buyerDetails,
        session,
      );

      await session.commitTransaction();

      kivoEvents.emit("order.fulfilled", {
        order,
        tickets,
        eventImage,
      });

      logger.info(`Free Booking Completed: Ref=${freeReference}`);

      return {
        isFree: true,
        reference: freeReference,
      };
    }

    // --- CASE 2: PAID TICKET FLOW (Paystack) ---
    const payment = await PaystackService.initializeTransaction({
      email: userEmail,
      amount: totalAmount * 100,
      callback_url: `${config.clientUrl}/verify-payment`,
      metadata: { userId, eventId, tierName, quantity, ...buyerDetails },
    });

    const [order] = await Order.create(
      [
        {
          user: userId || undefined,
          buyerEmail: userEmail.toLowerCase(),
          event: new mongoose.Types.ObjectId(eventId),
          tierName,
          quantity,
          totalAmount: totalAmount,
          paymentReference: payment.data.reference,
          paymentUrl: payment.data.authorization_url,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      ],
      { session },
    );

    await session.commitTransaction();
    logger.info(`Paid Booking Initialized: Ref=${order.paymentReference}`);

    return {
      isFree: false,
      authorization_url: order.paymentUrl,
      reference: order.paymentReference,
    };
  } catch (error: any) {
    await session.abortTransaction();
    logger.error(`Booking Aborted: ${error.message} - User: ${userEmail}`);
    throw error;
  } finally {
    await session.endSession();
  }
};

export const fulfillOrder = async (reference: string, metadata: any) => {
  logger.info(`Order Fulfillment Started: Ref=${reference}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ paymentReference: reference }).session(
      session,
    );

    if (!order) {
      logger.error(`Fulfillment Failed: Ref ${reference} not found`);
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Order with reference ${reference} not found`,
      );
    }

    if (order.status === ORDER_STATUS.COMPLETED) {
      logger.warn(`Fulfillment Skip: Ref ${reference} already completed`);
      await session.commitTransaction(); // Cleanly finish even if nothing to do
      return;
    }

    order.status = ORDER_STATUS.COMPLETED;
    await order.save({ session });

    const { tickets, eventImage } = await createTicketsForOrder(
      order,
      metadata,
      session,
    );

    await session.commitTransaction();

    kivoEvents.emit("order.fulfilled", {
      order,
      tickets,
      eventImage,
    });

    logger.info(`Order Fulfilled Successfully: Ref=${reference}`);
  } catch (error: any) {
    await session.abortTransaction();
    logger.error(
      `Order Fulfillment CRITICAL FAILURE: Ref=${reference} - ${error.message}`,
    );
    throw error;
  } finally {
    await session.endSession();
  }
};

export const getTicketById = async (ticketId: string) => {
  const ticket = await Ticket.findById(ticketId).populate({
    path: "event",
    select: "title startDate location image",
  });

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Ticket not found");
  }

  return ticket;
};

export const processTicketCheckIn = async (
  checkInCode: string,
  eventId: string,
  scannerId: string,
) => {
  // 1. Optimization: Check Auth and Event in one lean query
  // We use .lean() because we don't need Mongoose magic for the event check
  const event = await Event.findById(eventId)
    .select("organizer coOrganizers staff")
    .lean();

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  const isAuthorized =
    event.organizer.toString() === scannerId ||
    event.coOrganizers?.some(
      (id: { toString: () => string }) => id.toString() === scannerId,
    ) ||
    event.staff?.some(
      (s: { user: { toString: () => string } }) =>
        s.user.toString() === scannerId,
    );

  if (!isAuthorized) {
    throw new AppError(httpStatus.FORBIDDEN, "Not authorized to scan");
  }

  // 2. ATOMIC UPDATE (The Core Reliability Step)
  // We only update if status is NOT 'used'. This prevents race conditions.
  const ticket = await Ticket.findOneAndUpdate(
    {
      checkInCode: checkInCode.trim(), // Sanitize input
      event: eventId,
      status: { $ne: TICKET_STATUS.used },
    },
    {
      $set: {
        status: TICKET_STATUS.used,
        checkedInAt: new Date(),
        checkedInBy: scannerId,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate("event", "title");

  // 3. HANDLING THE "NOT FOUND" or "ALREADY USED" CASE
  if (!ticket) {
    const existingTicket = await Ticket.findOne({
      checkInCode,
      event: eventId,
    }).lean();

    if (!existingTicket) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Invalid Ticket: QR code not recognized.",
      );
    }

    // IDEMPOTENCY LOGIC:
    // If the ticket was ALREADY checked in by THIS scanner in the last 2 minutes,
    // treat it as a success. This fixes the "Sync Queue Retry" issue.
    const wasJustCheckedInByMe =
      existingTicket.status === TICKET_STATUS.used &&
      existingTicket.checkedInBy?.toString() === scannerId &&
      Date.now() - new Date(existingTicket.checkedInAt).getTime() < 120000;

    if (wasJustCheckedInByMe) {
      return {
        guestName: `${existingTicket.buyerInfo.firstName} ${existingTicket.buyerInfo.lastName}`,
        tier: existingTicket.tierName,
        checkedInAt: existingTicket.checkedInAt,
        alreadyProcessed: true, // Flag for frontend to show a "Already Synced" status
      };
    }

    if (existingTicket.status === TICKET_STATUS.used) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Used at ${new Date(existingTicket.checkedInAt).toLocaleTimeString()}`,
      );
    }

    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Ticket is invalid or cancelled",
    );
  }

  return {
    guestName: `${ticket.buyerInfo.firstName} ${ticket.buyerInfo.lastName}`,
    tier: ticket.tierName,
    checkedInAt: ticket.checkedInAt,
    eventTitle: ticket.event.title,
    alreadyProcessed: false,
  };
};
