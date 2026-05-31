import mongoose, { ClientSession } from "mongoose";
import httpStatus from "http-status";
import { nanoid } from "nanoid";
import crypto from "node:crypto";
import { Order } from "../../models/Order.js";
import {
  ORDER_STATUS,
  SCAN_LOG_STATUS,
  TICKET_STATUS,
} from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import AppError from "../../utils/AppError.js";
import { PaystackService } from "../../utils/paystackServices.js";
import config from "../../config/config.js";
import { Ticket } from "../../models/Ticket.js";
import { ScanLog } from "../../models/ScanLog.js";
import logger from "../../utils/logger.js";
import skauteEvents from "../../utils/eventsEmitter.js";
import { User } from "../../models/User.js";
import { Discount } from "../../models/Discount.js";
import { Transaction } from "../../models/Transaction.js";

/**
 * Locks inventory by incrementing the sold count only if capacity allows.
 * Uses atomic operations to prevent overselling in high-concurrency scenarios.
 */
export const lockInventory = async (
  eventId: string,
  tierName: string,
  quantity: number,
  session: ClientSession,
): Promise<number> => {
  logger.debug(
    `Inventory Lock Attempt: Event=${eventId} Tier=${tierName} Qty=${quantity}`,
  );

  const event = await Event.findOne({
    _id: eventId,
    "ticketTiers.name": tierName,
  }).session(session);

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event or Ticket Tier not found.");
  }

  if (event.isSoldOut === true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This move is officially sold out by the organizer.",
    );
  }

  const tierIndex = event.ticketTiers.findIndex(
    (t: any) => t.name === tierName,
  );
  const tier = event.ticketTiers[tierIndex];

  // Perform the Atomic Update checking execution limitations
  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: eventId,
      [`ticketTiers.${tierIndex}.name`]: tierName,
      [`ticketTiers.${tierIndex}.sold`]: { $lte: tier.capacity - quantity },
    },
    {
      $inc: {
        [`ticketTiers.${tierIndex}.sold`]: quantity,
        attendees: quantity,
      },
    },
    {
      session,
      new: true,
    },
  );

  if (!updatedEvent) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Sold Out: The requested tickets are no longer available for this tier.",
    );
  }

  // Explicitly return casted Number representation
  return Number(tier.price || 0);
};

const createTicketsForOrder = async (
  order: any,
  buyerDetails: { firstName: string; lastName: string },
  session: mongoose.ClientSession,
) => {
  const ticketsToCreate = [];

  for (let i = 0; i < order.quantity; i++) {
    const checkInCode = `SKT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const ticketCode = `REF-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const firstName =
      buyerDetails?.firstName || order?.buyerEmail?.split("@")[0] || "Guest";
    const lastName = buyerDetails?.lastName || "Attendee";

    ticketsToCreate.push({
      event: order.event,
      owner: order.user,
      order: order._id,
      tierName: order.tierName,
      pricePaid: order.totalAmount / order.quantity,
      buyerInfo: {
        firstName,
        lastName,
        email: order.buyerEmail,
      },
      ticketCode,
      checkInCode,
      status: TICKET_STATUS.valid || "valid",
    });
  }

  // 1. Insert documents directly into MongoDB via the transaction session
  const tickets = await Ticket.insertMany(ticketsToCreate, { session });

  // 2. FIXED: Populate using a clean type-safe layout that supports transactional sessions safely
  await Ticket.populate(tickets, [{ path: "event", options: { session } }]);

  // 3. Find event fallback details
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
  discountCode?: string,
  eventTitle?: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Inventory & Base Price Extraction
    const unitPrice = await lockInventory(eventId, tierName, quantity, session);
    const event = await Event.findById(eventId).session(session);
    if (!event)
      throw new AppError(httpStatus.NOT_FOUND, "Event data sync error");

    // Cross-validate real tier configuration to stop pricing bypass structural defects
    const matchedTier = event.ticketTiers.find((t: any) => t.name === tierName);
    const fundamentalDatabasePrice = Number(matchedTier?.price || 0);

    let totalAmount = unitPrice * quantity;
    let appliedDiscountId = null;

    // 2. Handle Coupon Deductions
    if (discountCode) {
      const result = await applyEventDiscount(
        event,
        discountCode,
        tierName,
        totalAmount,
        session,
      );
      totalAmount = result.newTotal;
      appliedDiscountId = result.discountId;
    }

    totalAmount = Math.round(totalAmount);

    // Strict validation requirement checking if booking qualifies for absolute free routes
    const isGenuinelyFree =
      totalAmount === 0 && (fundamentalDatabasePrice === 0 || discountCode);

    // 3. Idempotency Check (Only valid for paid routes to prevent overlapping pending sessions)
    if (!isGenuinelyFree) {
      const existingOrder = await Order.findOne({
        buyerEmail: userEmail.toLowerCase(),
        event: eventId,
        tierName,
        totalAmount,
        status: ORDER_STATUS.PENDING,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (existingOrder) {
        await session.abortTransaction();
        return {
          isFree: false,
          authorization_url: existingOrder.paymentUrl,
          reference: existingOrder.paymentReference,
        };
      }
    }

    // 4. Update Participant Metadata
    if (userId) await updateEventParticipantHype(eventId, userId, session);

    // 5. Core Payload Configuration Setup
    const orderData = {
      user: userId || undefined,
      buyerEmail: userEmail.toLowerCase(),
      event: new mongoose.Types.ObjectId(eventId),
      tierName,
      quantity,
      totalAmount,
      discount: appliedDiscountId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    // 6. Branch Execution Strategy: Free Execution Stack
    if (isGenuinelyFree) {
      const [order] = await Order.create(
        [
          {
            ...orderData,
            paymentReference: `SKT-${nanoid(10).toUpperCase()}`,
            status: ORDER_STATUS.COMPLETED,
          },
        ],
        { session },
      );

      await Transaction.create(
        [
          {
            user: userId || null,
            event: new mongoose.Types.ObjectId(eventId),
            type: "ticket_sale",
            amount: 0,
            fee: 0,
            netAmount: 0,
            status: "success",
            reference: order.paymentReference,
            metadata: {
              tierName,
              quantity,
              buyerEmail: userEmail.toLowerCase(),
              isFreeBooking: true,
              isGuestCheckout: !userId,
            },
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
      skauteEvents.emit("order.fulfilled", { order, tickets, eventImage });

      return {
        isFree: true,
        reference: order.paymentReference,
        checkInCode: tickets[0]?.checkInCode || "",
      };
    }

    // 7. Branch Execution Strategy: Paid Gateway Stack
    if (totalAmount <= 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid transactional sum calculated for a paid asset tier.",
      );
    }

    const payment = await PaystackService.initializeTransaction({
      email: userEmail,
      amount: totalAmount * 100, // Conversion parameters into Kobo denominations
      callback_url: `${config.clientUrl}/verify-payment`,
      metadata: {
        userId,
        eventId,
        tierName,
        quantity,
        discountCode,
        eventTitle,
        ...buyerDetails,
      },
    });

    await Order.create(
      [
        {
          ...orderData,
          paymentReference: payment.data.reference,
          paymentUrl: payment.data.authorization_url,
          status: ORDER_STATUS.PENDING,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return {
      isFree: false,
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
    };
  } catch (error: any) {
    if (session.inTransaction()) await session.abortTransaction();
    logger.error(`Booking Aborted: ${error.message} - User: ${userEmail}`);
    throw error;
  } finally {
    await session.endSession();
  }
};

export const fulfillOrder = async (
  reference: string,
  metadata: any,
  isDelayedReconciliation = false,
) => {
  logger.info(`Order Fulfillment Started: Ref=${reference}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOneAndUpdate(
      {
        paymentReference: reference,
        status: { $ne: ORDER_STATUS.COMPLETED },
      },
      {
        $set: { status: ORDER_STATUS.COMPLETED },
      },
      {
        session,
        new: true,
      },
    );

    if (!order) {
      const historicalOrder = await Order.findOne({
        paymentReference: reference,
      }).session(session);
      if (historicalOrder?.status === ORDER_STATUS.COMPLETED) {
        logger.warn(
          `Fulfillment Skip: Ref ${reference} was handled by a parallel process.`,
        );
        await session.commitTransaction();
        return;
      }

      throw new AppError(
        httpStatus.NOT_FOUND,
        `Order with reference ${reference} not found`,
      );
    }

    if (order.status === ORDER_STATUS.EXPIRED) {
      await lockInventory(
        order.event.toString(),
        order.tierName,
        order.quantity,
        session,
      );
      order.status = ORDER_STATUS.COMPLETED;
      await order.save({ session });
    }

    if (order.user) {
      const user = await User.findById(order.user).session(session);
      if (user?.image) {
        await Event.updateOne(
          {
            _id: order.event,
            participantImages: { $ne: user.image },
            $expr: { $lt: [{ $size: "$participantImages" }, 5] },
          },
          { $push: { participantImages: user.image } },
          { session },
        );
      }
    }

    const { tickets, eventImage } = await createTicketsForOrder(
      order,
      metadata,
      session,
    );
    await session.commitTransaction();

    skauteEvents.emit("order.fulfilled", {
      order,
      tickets,
      eventImage,
      isDelayedReconciliation,
    });

    logger.info(`Order Fulfilled Successfully: Ref=${reference}`);
  } catch (error: any) {
    if (session.inTransaction()) await session.abortTransaction();
    logger.error(
      `Order Fulfillment CRITICAL FAILURE: Ref=${reference} - ${error.message}`,
    );
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Validates and applies discount from the event's embedded array
 */
const applyEventDiscount = async (
  event: any,
  code: string,
  tierName: string,
  currentTotal: number,
  session: mongoose.ClientSession,
) => {
  const normalizedCode = code.toUpperCase().trim();
  const discount = event.discounts?.find(
    (d: any) => d.code === normalizedCode && d.isActive === true,
  );

  if (!discount) throw new Error("Invalid or deactivated discount code");

  const isApplicable =
    discount.applicableTickets.includes("all") ||
    discount.applicableTickets.some(
      (t: string) => t.toLowerCase() === tierName.toLowerCase(),
    );
  const isNotExpired =
    !discount.expiryDate || new Date() < new Date(discount.expiryDate);
  const hasUsageLeft =
    !discount.usageLimit || discount.usedCount < discount.usageLimit;

  if (!isApplicable) throw new Error(`Code not valid for the ${tierName} tier`);
  if (!isNotExpired) throw new Error("This discount code has expired");
  if (!hasUsageLeft) throw new Error("Discount usage limit reached");

  const reduction = (discount.discountPercentage / 100) * currentTotal;

  // Increment usage count atomically
  await Event.updateOne(
    { _id: event._id, "discounts.code": normalizedCode },
    { $inc: { "discounts.$.usedCount": 1 } },
    { session },
  );

  return {
    newTotal: Math.max(0, currentTotal - reduction),
    discountId: discount._id,
  };
};

/**
 * Handles adding user avatar to event hypelist
 */
const updateEventParticipantHype = async (
  eventId: string,
  userId: string,
  session: mongoose.ClientSession,
) => {
  const user = await User.findById(userId).session(session);
  if (user?.image) {
    await Event.updateOne(
      {
        _id: eventId,
        participantImages: { $ne: user.image },
        $expr: { $lt: [{ $size: "$participantImages" }, 5] },
      },
      { $push: { participantImages: user.image } },
      { session },
    );
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
  deviceFingerprint?: string,
  offlineTimestamp?: number,
) => {
  const event = await Event.findById(eventId)
    .select("organizer coOrganizers.user staff.user")
    .lean();

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  const isAuthorized =
    event.organizer.toString() === scannerId ||
    event.coOrganizers?.some(
      (coOrg: any) => coOrg.user?.toString() === scannerId,
    ) ||
    event.staff?.some((s: any) => s.user?.toString() === scannerId);

  if (!isAuthorized) {
    throw new AppError(httpStatus.FORBIDDEN, "Not authorized to scan");
  }

  const sanitizedCode = checkInCode.trim().toUpperCase();

  const exactCheckInTime = offlineTimestamp
    ? new Date(offlineTimestamp)
    : new Date();

  // 2. STRICT ATOMIC UPDATE
  const ticket = await Ticket.findOneAndUpdate(
    {
      checkInCode: sanitizedCode,
      event: eventId,
      status: TICKET_STATUS.valid,
    },
    {
      $set: {
        status: TICKET_STATUS.used,
        checkedInAt: exactCheckInTime,
        checkedInBy: scannerId,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate("event", "title");

  // 3. DETAILED EXCEPTION HANDLING WITH TELEMETRY LOGGING
  if (!ticket) {
    const existingTicket = await Ticket.findOne({
      checkInCode: sanitizedCode,
    })
      .populate("event", "title")
      .lean();

    // Context Exception 1: Code doesn't match any record in the cluster entirely
    if (!existingTicket) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Invalid Ticket: QR code not recognized.",
      );
    }

    // Context Exception 2: Ticket exists but was purchased for a different event profile entirely
    if (existingTicket.event?._id?.toString() !== eventId) {
      await ScanLog.create({
        event: eventId,
        ticket: existingTicket._id,
        scanner: scannerId,
        status: SCAN_LOG_STATUS.INVALID_EVENT,
        deviceFingerprint,
      });
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Security Violation: Ticket belongs to a completely different venue event.",
      );
    }

    // IDEMPOTENCY LOGIC:
    const wasJustCheckedInByMe =
      existingTicket.status === TICKET_STATUS.used &&
      (existingTicket.checkedInBy?.toString() === scannerId ||
        existingTicket.deviceFingerprint === deviceFingerprint) &&
      (offlineTimestamp
        ? true
        : Date.now() - new Date(existingTicket.checkedInAt).getTime() < 120000);

    if (wasJustCheckedInByMe) {
      return {
        guestName: `${existingTicket.buyerInfo.firstName} ${existingTicket.buyerInfo.lastName}`,
        tier: existingTicket.tierName,
        checkedInAt: existingTicket.checkedInAt,
        eventTitle: existingTicket.event?.title || "Event",
        alreadyProcessed: true,
      };
    }

    // Context Exception 3: Duplicate Scan Detected (Already checked in earlier or at another door)
    if (existingTicket.status === TICKET_STATUS.used) {
      await ScanLog.create({
        event: eventId,
        ticket: existingTicket._id,
        scanner: scannerId,
        status: SCAN_LOG_STATUS.DUPLICATE,
        deviceFingerprint,
      });
      throw new AppError(
        httpStatus.CONFLICT,
        `Already Used at ${new Date(existingTicket.checkedInAt).toLocaleTimeString()}`,
      );
    }

    // Context Exception 4: Revoked, Refunded, Cancelled, or Transferred asset states
    if (
      existingTicket.status === TICKET_STATUS.refunded ||
      existingTicket.status === TICKET_STATUS.cancelled ||
      existingTicket.status === TICKET_STATUS.transferred
    ) {
      await ScanLog.create({
        event: eventId,
        ticket: existingTicket._id,
        scanner: scannerId,
        status: SCAN_LOG_STATUS.REVOKED_TICKET,
        deviceFingerprint,
      });

      const trackingStatusName =
        existingTicket.status.charAt(0).toUpperCase() +
        existingTicket.status.slice(1);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Access Denied: Ticket has been ${trackingStatusName}.`,
      );
    }

    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Ticket is invalid or inactive.",
    );
  }

  // 4. LOG SUCCESSFUL CHECK-IN METRICS
  await ScanLog.create({
    event: eventId,
    ticket: ticket._id,
    scanner: scannerId,
    status: SCAN_LOG_STATUS.SUCCESS,
    deviceFingerprint,
  });

  return {
    guestName: `${ticket.buyerInfo.firstName} ${ticket.buyerInfo.lastName}`,
    tier: ticket.tierName,
    checkedInAt: ticket.checkedInAt,
    eventTitle: ticket.event.title,
    alreadyProcessed: false,
  };
};

export const verifyAndFulfillOrder = async (reference: string) => {
  const order = await Order.findOne({ paymentReference: reference }).populate(
    "event",
    "title",
  );

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction not found");
  }

  // 1. If already completed, return early with tickets
  if (order.status === ORDER_STATUS.COMPLETED) {
    const tickets = await Ticket.find({ order: order._id });
    return { status: "success", order, tickets };
  }

  // 2. If PENDING, check Paystack directly (Safety Net for failed webhooks)
  const paystackData = await PaystackService.verifyTransaction(reference);

  if (paystackData?.data?.status === "success") {
    // Webhook might have lagged, so we fulfill it manually here
    await fulfillOrder(reference, paystackData.data.metadata);

    const tickets = await Ticket.find({ order: order._id });
    const updatedOrder = await Order.findById(order._id);

    return { status: "success", order: updatedOrder, tickets };
  }

  // 3. Still not paid
  return { status: "pending", message: "We are finalizing your tickets..." };
};

export const releaseExpiredInventory = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find orders that are PENDING and past their expiresAt time
    const expiredOrders = await Order.find({
      status: ORDER_STATUS.PENDING,
      expiresAt: { $lt: new Date() },
    }).session(session);

    if (expiredOrders.length === 0) {
      await session.commitTransaction();
      return;
    }

    for (const order of expiredOrders) {
      // 2. Reverse the increment in the Event model
      await Event.updateOne(
        {
          _id: order.event,
          "ticketTiers.name": order.tierName,
        },
        {
          $inc: {
            "ticketTiers.$[tier].sold": -order.quantity,
            attendees: -order.quantity,
          },
        },
        {
          arrayFilters: [{ "tier.name": order.tierName }],
          session,
        },
      );

      // 3. Mark the order as CANCELLED or EXPIRED so it's not processed again
      order.status = ORDER_STATUS.EXPIRED;
      await order.save({ session });

      logger.info(
        `Inventory Released: Ref ${order.paymentReference} for Event ${order.event}`,
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    logger.error("Failed to release expired inventory:", error);
  } finally {
    await session.endSession();
  }
};

export const processTicketRefund = async (ticketCode: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Ticket & Order (to get Paystack reference)
    const ticket = await Ticket.findOne({ ticketCode })
      .populate("order")
      .session(session);
    if (!ticket) throw new AppError(httpStatus.NOT_FOUND, "Ticket not found");
    if (ticket.status === TICKET_STATUS.refunded)
      throw new AppError(httpStatus.BAD_REQUEST, "Already refunded");

    const order = ticket.order as any;

    // 2. Paystack Refund (Money Side)
    // Convert pricePaid to Kobo for Paystack
    const refundAmountKobo = Math.round(ticket.pricePaid * 100);

    try {
      await PaystackService.refund(order.paymentReference, refundAmountKobo);
    } catch (err: any) {
      throw new AppError(
        httpStatus.FAILED_DEPENDENCY,
        "Paystack refund failed. Check balance.",
      );
    }

    // 3. Mark Ticket Refunded
    ticket.status = TICKET_STATUS.refunded;
    await ticket.save({ session });

    // 4. Restore Inventory (Atomic decrement)
    await Event.findOneAndUpdate(
      { _id: ticket.event, "ticketTiers.name": ticket.tierName },
      { $inc: { "ticketTiers.$.sold": -1, attendees: -1 } },
      { session },
    );

    const grossRefundAmount = ticket.pricePaid;

    // Calculate your platform fee reversal using your commission structure (e.g., 10%)
    const platformFeeReversal = grossRefundAmount * 0.1;
    const netAmountReversal = grossRefundAmount - platformFeeReversal;

    // Pass the documents in an array so Mongoose can bind them to the session lifecycle
    await Transaction.create(
      [
        {
          user: order.user ? order.user.toString() : null, // Handle logged-in users vs guests
          event: ticket.event.toString(),
          type: "refund", // 💡 FIXED: Matches the exact "refund" string configuration expected by the transaction schema enum validator
          amount: -grossRefundAmount, // Negative deduction from overall ticket sales
          fee: -platformFeeReversal, // Negative deduction from platform profit metrics
          netAmount: -netAmountReversal, // Negative deduction from what organizer is owed
          status: "success",
          reference: `REFUND-${order.paymentReference}-${Date.now()}`,
          metadata: {
            originalPaymentReference: order.paymentReference,
            ticketCode: ticketCode,
            tierName: ticket.tierName,
            buyerEmail: order.buyerEmail,
            initiatedReason: "Admin/Organizer Initiated Refund",
          },
        },
      ],
      { session }, // Crucial: Binds this record creation to your transaction session
    );

    // Commit all changes together (Ticket Status + Event Inventory Counters + Transaction Log)
    await session.commitTransaction();

    // 5. Async Notification
    skauteEvents.emit("ticket.refunded", { ticket, order });

    return ticket;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
