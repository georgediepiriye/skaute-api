import mongoose, { ClientSession } from "mongoose";

import { Order } from "../../models/Order.js";
import { ORDER_STATUS } from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import AppError from "../../utils/AppError.js";
import { PaystackService } from "../../utils/paystackServices.js";
import config from "../../config/config.js";
import { Ticket } from "../../models/Ticket.js";
import { nanoid } from "nanoid";
import logger from "../../utils/logger.js"; // Import your winston logger
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
  // DEBUG LOG: Track inventory attempts
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
    throw new Error(
      `Event not found or Ticket Tier "${tierName}" does not exist.`,
    );
  }

  const tier = updatedEvent.ticketTiers.find((t: any) => t.name === tierName);

  if (!tier) {
    throw new Error(
      "Internal integrity error: Ticket tier vanished during update.",
    );
  }

  // Capacity Check
  if (tier.sold > tier.capacity) {
    logger.warn(
      `Sold Out Triggered: Event=${eventId} Tier=${tierName} (Sold:${tier.sold} > Cap:${tier.capacity})`,
    );
    throw new Error(`Sold Out: ${tierName} has reached maximum capacity.`);
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
    const ticketCode = `KIVO-${nanoid(8).toUpperCase()}`;
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
      ticketCode,
      qrCodeData: JSON.stringify({ code: ticketCode, eventId: order.event }),
      status: "valid",
    });
  }

  // Batch insert tickets
  const tickets = await Ticket.insertMany(ticketsToCreate, { session });

  // Fetch event details (e.g., for the image in the email)
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

      // Create tickets immediately in the same transaction
      const { tickets, eventImage } = await createTicketsForOrder(
        order,
        buyerDetails,
        session,
      );

      await session.commitTransaction();

      // Emit event for email service
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
      amount: totalAmount * 100, // Convert to kobo
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
      await session.endSession();
      return;
    }

    if (order.status === ORDER_STATUS.COMPLETED) {
      logger.warn(`Fulfillment Skip: Ref ${reference} already completed`);
      await session.endSession();
      return;
    }

    // Update status and create tickets using the helper
    order.status = ORDER_STATUS.COMPLETED;
    await order.save({ session });

    const { tickets, eventImage } = await createTicketsForOrder(
      order,
      metadata, // contains firstName, lastName from Paystack metadata
      session,
    );

    await session.commitTransaction();

    // Trigger Email/Success events
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
