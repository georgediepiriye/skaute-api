import mongoose, { Types } from "mongoose";
import { CoOrganizerPermission, Event, IEvent } from "../../models/Event.js";
import EventView from "../../models/EventView.js";
import { Ticket } from "../../models/Ticket.js";
import { User } from "../../models/User.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";
import httpStatus from "http-status";
import { CreateDiscountInput } from "../../validation/eventValidation.js";
import { ScanLog } from "../../models/ScanLog.js";
import { Payout } from "../../models/Payout.js";
import config from "../../config/config.js";
import skauteEvents from "../../utils/eventsEmitter.js";
import { lockInventory } from "./ticketService.js";
import crypto from "node:crypto";
import { ORDER_STATUS } from "../../lib/constants.js";
import { Order } from "../../models/Order.js";
import { Transaction } from "../../models/Transaction.js";

export const createNewEvent = async (
  eventData: Partial<IEvent>,
  organizerId: string,
) => {
  if (eventData.eventFormat === "online" && eventData.location) {
    delete eventData.location;
  }

  logger.info(
    `Event Broadcast Initiated: Title="${eventData.title}" OrganizerID=${organizerId}`,
  );

  const mainEvent = await Event.create({
    ...eventData,
    organizer: organizerId,
  });

  logger.info(
    `Main Event Created: ID=${mainEvent._id} Recurring=${mainEvent.isRecurring}`,
  );

  if (mainEvent.isRecurring && mainEvent.recurrence?.frequency !== "none") {
    // Generate instances asynchronously or via helper
    await generateEventInstances(mainEvent);
  }

  return mainEvent;
};

export const updateEvent = async (
  eventId: string,
  updateData: Partial<IEvent>,
  userId: string,
) => {
  // 1. Find the existing event
  const event = await Event.findById(eventId);

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  // 2. Authorization Check
  const isOrganizer = event.organizer.toString() === userId;
  const isCoOrganizer = event.coOrganizers?.some(
    (id: any) => id.toString() === userId,
  );

  if (!isOrganizer && !isCoOrganizer) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to edit this event",
    );
  }

  // 3. Ticketing Edit Protection logic
  // Prevents breaking the event's financial integrity if tickets are already sold
  if (updateData.ticketTiers) {
    for (const existingTier of event.ticketTiers) {
      const incomingTier = updateData.ticketTiers.find(
        (t) => t.name === existingTier.name,
      );

      // Check if any tickets have been sold for this specific tier
      // (Assumes you have a 'sold' field in your ticketTier sub-schema)
      const ticketsSold = existingTier.sold || 0;

      if (ticketsSold > 0) {
        // Prevent deleting a tier that has active attendees
        if (!incomingTier) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Cannot remove the '${existingTier.name}' tier because tickets have already been sold.`,
          );
        }

        // Prevent reducing capacity below the number of people already confirmed
        if (incomingTier.capacity < ticketsSold) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Capacity for '${existingTier.name}' cannot be lowered to ${incomingTier.capacity} because ${ticketsSold} tickets are already sold.`,
          );
        }
      }
    }
  }

  // 4. Handle Format-Specific Logic
  if (updateData.eventFormat === "online") {
    updateData.location = undefined;
    updateData.isOnline = true;
  } else if (
    updateData.eventFormat === "physical" ||
    updateData.eventFormat === "hybrid"
  ) {
    updateData.isOnline = false;
  }

  // 5. Perform the update
  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedEvent) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update event",
    );
  }

  // 6. Handle Recurring Logic Sync
  // If this is a parent event, propagate "cosmetic" changes to all future instances
  if (updatedEvent.isRecurring && !updatedEvent.recurrence?.parentId) {
    const syncFields: any = {};
    if (updateData.title) syncFields.title = updatedEvent.title;
    if (updateData.description)
      syncFields.description = updatedEvent.description;
    if (updateData.image) syncFields.image = updatedEvent.image;
    if (updateData.category) syncFields.category = updatedEvent.category;

    if (Object.keys(syncFields).length > 0) {
      await Event.updateMany(
        {
          "recurrence.parentId": updatedEvent._id,
          startDate: { $gt: new Date() }, // Only sync future instances
        },
        { $set: syncFields },
      );
      logger.info(
        `Synced recurring instances for ParentID=${updatedEvent._id}`,
      );
    }
  }

  logger.info(`Event Updated: ID=${eventId} by User=${userId}`);
  return updatedEvent;
};

export const generateEventInstances = async (parentEvent: IEvent) => {
  const {
    frequency = "none",
    interval = 1,
    endDate,
    daysOfWeek = [],
  } = parentEvent.recurrence || {};

  if (frequency === "none") return;

  logger.info(
    `Recurrence Generation Started: ParentID=${parentEvent._id} Frequency=${frequency}`,
  );

  const instances = [];
  const stopDate = endDate ? new Date(endDate) : new Date();
  if (!endDate) stopDate.setMonth(stopDate.getMonth() + 3);

  let currentStartDate = new Date(parentEvent.startDate);
  const duration =
    new Date(parentEvent.endDate).getTime() - currentStartDate.getTime();

  while (true) {
    if (frequency === "daily") {
      currentStartDate.setDate(currentStartDate.getDate() + interval);
    } else if (frequency === "weekly") {
      currentStartDate.setDate(currentStartDate.getDate() + 7 * interval);
    } else if (frequency === "monthly") {
      currentStartDate.setMonth(currentStartDate.getMonth() + interval);
    }

    if (currentStartDate > stopDate) break;

    if (frequency === "weekly" && daysOfWeek.length > 0) {
      if (!daysOfWeek.includes(currentStartDate.getDay())) continue;
    }

    const instanceData = parentEvent.toObject();
    delete instanceData._id;
    delete instanceData.id;
    delete instanceData.createdAt;
    delete instanceData.updatedAt;

    const newStart = new Date(currentStartDate);
    const newEnd = new Date(newStart.getTime() + duration);

    instances.push({
      ...instanceData,
      startDate: newStart,
      endDate: newEnd,
      attendees: 0,
      participantImages: [],
      recurrence: {
        ...parentEvent.recurrence,
        parentId: parentEvent._id,
      },
    });

    if (instances.length >= 100) {
      logger.warn(
        `Recurrence generation hit safety limit (100) for ParentID=${parentEvent._id}`,
      );
      break;
    }
  }

  if (instances.length > 0) {
    await Event.insertMany(instances);
    logger.info(
      `Recurrence Generation Complete: Created ${instances.length} instances for ParentID=${parentEvent._id}`,
    );
  }
};

interface EventFilterQuery {
  title?: string;
  category?: string;
  isBoosted?: string;
  isSkauteHosted?: string;
  timeStatus?: "live" | "upcoming";
  "startDate[lte]"?: string;
  "endDate[gte]"?: string;
  eventFormat?: "online" | "physical";
  lat?: string;
  lng?: string;
  [key: string]: any;
}

/**
 * 1. EXTRACT EXTRA QUERY PARAMS
 * Strips API control parameters to leave clean matching properties
 */
const extractBaseQueryObj = (query: EventFilterQuery) => {
  const queryObj = { ...query };
  const excludedFields = [
    "page",
    "sort",
    "limit",
    "fields",
    "dateFilter",
    "timeStatus",
    "startDate[lte]",
    "endDate[gte]",
    "lat",
    "lng",
    "isSkauteHosted",
  ];
  excludedFields.forEach((el) => delete queryObj[el]);
  return queryObj;
};

/**
 * 2. BUILD MUTATED MONGOOSE FILTER
 * Handles text matches, geofencing, date timelines, and platform properties
 */
const buildEventFilter = (
  query: EventFilterQuery,
  now: Date = new Date(),
): any => {
  const queryObj = extractBaseQueryObj(query);

  const filter: any = {
    ...queryObj,
    approvalStatus: "approved",
    isCancelled: false,
  };

  filter.endDate = { $gte: now };

  if (filter.title) filter.title = { $regex: filter.title, $options: "i" };
  if (queryObj.category?.includes(",")) {
    filter.category = { $in: queryObj.category.split(",") };
  }

  // Boosting & Platform Rules
  if (query.isBoosted === "true") {
    filter.isBoosted = true;
    filter.boostExpiry = { $gt: now };
  }
  if (query.isSkauteHosted === "true") filter.isSkauteHosted = true;
  if (query.isSkauteHosted === "false") filter.isSkauteHosted = false;

  // Time Status Logic (Live vs Upcoming)
  if (query.timeStatus === "live") {
    filter.startDate = { $lte: now };
    filter.endDate = { $gte: now };
  } else if (query.timeStatus === "upcoming") {
    filter.startDate = { $gt: now };
  }

  // Explicit Date Range Logic
  if (query["startDate[lte]"]) {
    filter.startDate = {
      ...(filter.startDate || {}),
      $lte: new Date(query["startDate[lte]"]),
    };
  }
  if (query["endDate[gte]"]) {
    filter.endDate = {
      ...(filter.endDate || {}),
      $gte: new Date(query["endDate[gte]"]),
    };
  }

  // Location Format Logic
  if (query.eventFormat) {
    if (query.eventFormat === "online")
      filter.eventFormat = { $in: ["online", "hybrid"] };
    if (query.eventFormat === "physical")
      filter.eventFormat = { $in: ["physical", "hybrid"] };
  }

  // Geospatial Bound Layer (Port Harcourt radius focus)
  if (query.lat && query.lng) {
    filter.location = {
      $geoWithin: {
        $centerSphere: [
          [parseFloat(query.lng), parseFloat(query.lat)],
          50 / 6378.1, // 50km radius
        ],
      },
    };
  }

  return filter;
};

/**
 * 3. EXECUTABLE SORT PIPELINE DEFINITION
 * Manages Discovery Engine sorting chains smoothly
 */
const applyQuerySorting = (dbQuery: any, sortParam?: string) => {
  if (sortParam) {
    return dbQuery.sort(sortParam.split(",").join(" "));
  }

  return dbQuery.sort({
    priorityLevel: -1, // Dynamic Tier Engine Placement (8 > 4 > 2 > 0)
    isBoosted: -1, // Active commercial boosts within matching priority tiers
    startDate: 1, // Happening soonest
    createdAt: -1, // Newest entries fallback
  });
};

/**
 * MASTER EXPORTED SERVICE FUNCTION
 */
export const getAllEvents = async (query: EventFilterQuery) => {
  const now = new Date();
  const filter = buildEventFilter(query, now);

  // Initialize and populate base mongoose execution query
  let dbQuery = Event.find(filter).select("-discounts").populate({
    path: "organizer",
    select: "name image location role",
  });

  // Apply discovery sorting
  dbQuery = applyQuerySorting(dbQuery, query.sort);

  // Setup Pagination Metrics
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  // Run total counts and document array requests in parallel
  const [events, total] = await Promise.all([
    dbQuery.skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

type EventViewContext = {
  userId?: string;
  ip?: string;
  deviceFingerprint?: string;
  userAgent?: string;
};

const getLagosDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const buildViewerKey = ({
  userId,
  ip,
  deviceFingerprint,
  userAgent,
}: EventViewContext) => {
  const rawKey = userId
    ? `user:${userId}`
    : deviceFingerprint
      ? `device:${deviceFingerprint}`
      : `ip:${ip || "unknown"}:${userAgent || "unknown"}`;

  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

export const recordEventView = async (
  eventId: string,
  context: EventViewContext,
) => {
  const eventExists = await Event.exists({ _id: eventId });

  if (!eventExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  const viewedOn = getLagosDateKey();
  const viewerKey = buildViewerKey(context);

  try {
    await EventView.create({
      event: eventId,
      viewerKey,
      viewedOn,
      user: context.userId,
      ip: context.ip,
      deviceFingerprint: context.deviceFingerprint,
      userAgent: context.userAgent,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      const event = await Event.findById(eventId).select("_id views");
      return { event, counted: false };
    }

    throw error;
  }

  const event = await Event.findByIdAndUpdate(
    eventId,
    { $inc: { views: 1 } },
    { new: true, runValidators: true },
  ).select("_id views");

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  return { event, counted: true };
};

export const findNearbyEvents = async (
  lng: number,
  lat: number,
  distanceInKm: number,
) => {
  // SYSTEM LOG: Geospatial queries are resource intensive
  logger.info(`GeoSearch: Lng=${lng}, Lat=${lat}, Radius=${distanceInKm}km`);

  const radius = distanceInKm / 6378.1;

  try {
    const events = await Event.find({
      location: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius],
        },
      },
    });
    logger.info(`GeoSearch Success: Found ${events.length} nearby events`);
    return events;
  } catch (error: any) {
    logger.error(`GeoSearch Failed: ${error.message}`);
    throw error;
  }
};

export const getEventById = async (id: string) => {
  const event = await Event.findById(id).select("-discounts").populate({
    path: "organizer",
    select: "name image",
  });

  if (!event) {
    logger.warn(`Event lookup failed: ID ${id} not found`);
  }

  return event;
};

export const getManagementDashboardData = async (
  eventId: string,
  userId: string,
  page: number = 1,
  limit: number = 20,
) => {
  const SKAUTE_FEE_PERCENT = Number(config.skauteFeePercent) || 5.5;

  /**
   * 1. EVENT LOOKUP & VALIDATION
   */
  const event = await Event.findById(eventId).populate({
    path: "coOrganizers.user",
    select: "name image email",
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  /**
   * 2. SECURITY & AUTHORIZATION CHECK
   */
  const isOwner = event.organizer.toString() === userId;
  const isCoOrg = event.coOrganizers?.some((coOrg: any) => {
    const coOrgUserId = coOrg.user?._id
      ? coOrg.user._id.toString()
      : coOrg.user?.toString();
    return coOrgUserId === userId;
  });

  if (!isOwner && !isCoOrg) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Unauthorized access to dashboard",
    );
  }

  /**
   * 3. ACTIVE TICKET FILTER
   */
  const activeTicketFilter = {
    event: new mongoose.Types.ObjectId(eventId),
    status: { $in: ["valid", "used"] },
  };

  /**
   * 4. QUANTITY & ATTENDANCE METRICS
   */
  const metricsData = await Ticket.aggregate([
    { $match: activeTicketFilter },
    {
      $group: {
        _id: null,
        totalSold: { $sum: 1 },
        checkInCount: {
          $sum: { $cond: [{ $eq: ["$status", "used"] }, 1, 0] },
        },
      },
    },
  ]);

  const stats = metricsData[0] || { totalSold: 0, checkInCount: 0 };

  /**
   * 5. GRANULAR FINANCIAL RECONCILIATION ENGINE
   */
  const transactionStats = await Transaction.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(eventId),
        status: "success",
      },
    },
    {
      $group: {
        _id: null,
        grossOnlineRevenue: {
          $sum: { $cond: [{ $eq: ["$type", "ticket_sale"] }, "$amount", 0] },
        },
        onlinePlatformFees: {
          $sum: { $cond: [{ $eq: ["$type", "ticket_sale"] }, "$fee", 0] },
        },
        liquidOnlineNet: {
          $sum: { $cond: [{ $eq: ["$type", "ticket_sale"] }, "$netAmount", 0] },
        },
        grossGateRevenue: {
          $sum: { $cond: [{ $eq: ["$type", "gate_sale"] }, "$amount", 0] },
        },
        gatePlatformFees: {
          $sum: { $cond: [{ $eq: ["$type", "gate_sale"] }, "$fee", 0] },
        },
      },
    },
  ]);

  const financialLedger = transactionStats[0] || {
    grossOnlineRevenue: 0,
    onlinePlatformFees: 0,
    liquidOnlineNet: 0,
    grossGateRevenue: 0,
    gatePlatformFees: 0,
  };

  // Safe Type Normalization — guards against undefined properties blowing up .toFixed()
  const grossOnline = Number(
    (financialLedger.grossOnlineRevenue || 0).toFixed(2),
  );
  const feesOnline = Number(
    (financialLedger.onlinePlatformFees || 0).toFixed(2),
  );
  const netOnlinePool = Number(
    (financialLedger.liquidOnlineNet || 0).toFixed(2),
  );

  const grossGate = Number((financialLedger.grossGateRevenue || 0).toFixed(2));
  const feesGateDebt = Number(
    (financialLedger.gatePlatformFees || 0).toFixed(2),
  );

  /**
   * 6. PAYOUTS & BANK SETTLEMENTS LEDGER
   */
  const payoutAggregation = await Payout.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(eventId),
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalRequested: { $sum: "$amount" },
        totalCompleted: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
        },
        totalPending: {
          $sum: {
            $cond: [
              { $in: ["$status", ["pending", "processing"]] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const payoutStats = payoutAggregation[0] || {
    totalRequested: 0,
    totalCompleted: 0,
    totalPending: 0,
  };

  const payoutsPaid = Number((payoutStats.totalCompleted || 0).toFixed(2));
  const payoutsPending = Number((payoutStats.totalPending || 0).toFixed(2));

  /**
   * 7. ADVANCED MATHEMATICAL WALLET RECONCILIATION
   */
  const totalCombinedGrossRevenue = Number(
    (grossOnline + grossGate).toFixed(2),
  );
  const totalSkauteCommissions = Number((feesOnline + feesGateDebt).toFixed(2));

  const totalOrganizerLifetimeNet = Math.max(
    Number((totalCombinedGrossRevenue - totalSkauteCommissions).toFixed(2)),
    0,
  );

  const rawSkauteHeldCash = netOnlinePool;

  const withdrawableBalance = Math.max(
    Number(
      (rawSkauteHeldCash - feesGateDebt - payoutsPaid - payoutsPending).toFixed(
        2,
      ),
    ),
    0,
  );

  /**
   * 8. QUANTITY AND VALUE SALES BY TIER (FIXED STRATEGY)
   * Using case-insensitive / trimmed matching on string tier names ensures
   * data integrity regardless of whether ticketTier ObjectIds exist.
   */
  const tierStats = await Ticket.aggregate([
    { $match: activeTicketFilter },
    {
      $group: {
        _id: "$tierName",
        sold: { $sum: 1 },
        grossRevenue: { $sum: "$pricePaid" },
      },
    },
  ]);

  const salesByTier = event.ticketTiers.map((tier: any) => {
    // Perform clean, case-insensitive string matching fallback configurations
    const stat = tierStats.find(
      (s) => s._id?.trim().toLowerCase() === tier.name?.trim().toLowerCase(),
    );

    const tierGrossRevenue = Number(stat?.grossRevenue || 0);
    const tierPlatformFee = Number(
      ((tierGrossRevenue * SKAUTE_FEE_PERCENT) / 100).toFixed(2),
    );
    const tierOrganizerRevenue = Number(
      (tierGrossRevenue - tierPlatformFee).toFixed(2),
    );

    return {
      name: tier.name,
      sold: stat?.sold || 0,
      capacity: tier.capacity,
      grossRevenue: tierGrossRevenue,
      platformFee: tierPlatformFee,
      organizerRevenue: tierOrganizerRevenue,
    };
  });

  /**
   * 9. GUEST LIST ATTENDEES WITH FRONTEND SCHEMA SYNC
   */
  const skip = (page - 1) * limit;
  const [rawAttendees, totalCount] = await Promise.all([
    Ticket.find({ event: eventId })
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .populate("owner", "name image email")
      .populate("checkedInBy", "name image")
      .lean(),
    Ticket.countDocuments({ event: eventId }),
  ]);

  // Frontend Schema Mapping Loop
  // Dynamically switches between on-premise 'buyerInfo' schemas and standard 'owner' accounts
  const attendees = rawAttendees.map((ticket: any) => {
    // 1. Check if the ticket already has an embedded buyerInfo profile (Gate-generated tickets)
    if (
      ticket.buyerInfo &&
      (ticket.buyerInfo.firstName || ticket.buyerInfo.email)
    ) {
      return {
        ...ticket,
        buyerInfo: {
          firstName: ticket.buyerInfo.firstName || "Guest",
          lastName: ticket.buyerInfo.lastName || "User",
          email: ticket.buyerInfo.email || "unknown@skaute.com",
        },
      };
    }

    // 2. Fallback: Parse populated user 'owner' data models (Online-purchased tickets)
    const names = ticket.owner?.name ? ticket.owner.name.split(" ") : ["Guest"];
    return {
      ...ticket,
      buyerInfo: {
        firstName: names[0],
        lastName: names.slice(1).join(" ") || "User",
        email: ticket.owner?.email || "unknown@skaute.com",
      },
    };
  });

  /**
   * 10. CLEAN CLEAN ITEMISED STRUCTURAL DASHBOARD PAYLOAD
   */
  return {
    event,
    attendees,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
    metrics: {
      grossRevenue: totalCombinedGrossRevenue,
      platformFeePercent: SKAUTE_FEE_PERCENT,
      platformFeeAmount: totalSkauteCommissions,
      organizerNetRevenue: totalOrganizerLifetimeNet,
      withdrawableBalance: withdrawableBalance,
      ticketQuantities: {
        totalTicketsSold: stats.totalSold,
        checkInCount: stats.checkInCount,
      },
      financials: {
        config: {
          platformFeePercent: SKAUTE_FEE_PERCENT,
        },
        overallTotals: {
          combinedGrossRevenue: totalCombinedGrossRevenue,
          totalSkauteCommissions: totalSkauteCommissions,
          organizerLifetimeNetWorth: totalOrganizerLifetimeNet,
        },
        onlineSalesChannel: {
          grossRevenue: grossOnline,
          skauteCommissions: feesOnline,
          cleanNetPool: netOnlinePool,
        },
        physicalGateChannel: {
          grossRevenue: grossGate,
          skauteCommissionsDebt: feesGateDebt,
          organizerCollectedCash: Math.max(
            Number((grossGate - feesGateDebt).toFixed(2)),
            0,
          ),
        },
        skauteVaultLedger: {
          initialHeldCash: rawSkauteHeldCash,
          deductions: {
            gateCommissionsClawback: feesGateDebt,
            payoutsTransferred: payoutsPaid,
            payoutsLockedInTransit: payoutsPending,
          },
          finalWithdrawableBalance: withdrawableBalance,
        },
      },
      salesByTier,
    },
  };
};

export const addPartnerToEvent = async (
  eventId: string,
  email: string,
  permissions: string[],
  organizerId: string,
) => {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  if (event.organizer.toString() !== organizerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the main host can add co-organizers",
    );
  }

  const userToAdd = await User.findOne({ email });
  if (!userToAdd) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found. They must sign up on skaute first.",
    );
  }

  if (userToAdd._id.toString() === event.organizer.toString()) {
    throw new AppError(httpStatus.BAD_REQUEST, "You are already the host");
  }

  // Safe verification: Search via the updated object property structural lookup key (.user)
  const alreadyPartner = event.coOrganizers?.some(
    (co: any) => co.user.toString() === userToAdd._id.toString(),
  );

  if (alreadyPartner) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This user is already a partner",
    );
  }

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    {
      $push: {
        coOrganizers: {
          user: userToAdd._id,
          permissions: permissions,
          assignedAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  ).populate("coOrganizers.user", "name email image");

  return updatedEvent;
};

export const removePartnerFromEvent = async (
  eventId: string,
  partnerId: string,
  organizerId: string,
) => {
  // 1. Find the event
  const event = await Event.findById(eventId);
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  // 2. Security: Only the MAIN organizer can remove partners
  if (event.organizer.toString() !== organizerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the main host has permission to remove partners",
    );
  }

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    {
      $pull: {
        coOrganizers: { user: partnerId },
      },
    },
    { new: true, runValidators: true },
  ).populate("coOrganizers.user", "name image email");

  if (!updatedEvent) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Failed to update event tracking configurations",
    );
  }

  return updatedEvent;
};

export const getEventBySlug = async (slug: string) => {
  const event = await Event.findOne({
    slug: slug,
  })
    .populate({
      path: "organizer",
      select: "name image location",
    })
    .select("-discounts");

  return event;
};

/**
 * Adds a new discount code to an event's growth tools.
 * Ensures the user is authorized and the code is unique for this move.
 */
export const addDiscountToEvent = async (
  eventId: string,
  discountData: CreateDiscountInput["body"],
  userId: string,
) => {
  // 1. Fetch the event and check existence
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  // 2. Authorization: Organizer or Co-Organizer only
  const isOrganizer = event.organizer.toString() === userId;
  const isCoOrg = event.coOrganizers?.some(
    (id: { toString: () => string }) => id.toString() === userId,
  );

  if (!isOrganizer && !isCoOrg) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Unauthorized to manage growth tools for this event",
    );
  }

  // 3. Uniqueness Check: Prevent duplicate codes on the same event
  const normalizedCode = discountData.code.toUpperCase().trim();
  const codeExists = event.discounts?.some(
    (d: { code: string }) => d.code === normalizedCode,
  );

  if (codeExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `The code "${normalizedCode}" is already active for this move.`,
    );
  }

  // 4. Sanitize and Push Data
  const newDiscount = {
    code: normalizedCode,
    discountPercentage: discountData.discountPercentage,
    applicableTickets: discountData.applicableTickets || [],
    usageLimit: discountData.usageLimit
      ? Number(discountData.usageLimit)
      : null,
    expiryDate: discountData.expiryDate
      ? new Date(discountData.expiryDate)
      : null,
    isActive: true,
    usedCount: 0,
  };

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    {
      $push: { discounts: newDiscount },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedEvent) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update event growth tools",
    );
  }

  return updatedEvent;
};

/**
 * Removes a discount code from the event.
 */
export const removeDiscountCode = async (
  eventId: string,
  codeId: string,
  userId: string,
) => {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  const isOrganizer = event.organizer.toString() === userId;
  if (!isOrganizer) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only main organizers can delete codes",
    );
  }

  return await Event.findByIdAndUpdate(
    eventId,
    { $pull: { discounts: { _id: codeId } } },
    { new: true },
  );
};

/**
 * Validates a discount code for a specific event and ticket tier.
 */
export const verifyDiscountCode = async (
  eventId: string,
  code: string,
  tierName: string,
) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  const normalizedCode = code.toUpperCase().trim();

  // Find the discount in the event's discounts array
  const discount = event.discounts?.find((d: any) => d.code === normalizedCode);

  if (!discount) {
    throw new AppError(httpStatus.NOT_FOUND, "Invalid discount code");
  }

  // 1. Check if the code is active
  if (!discount.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, "This code is no longer active");
  }

  // 2. Check Expiry Date
  if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This discount code has expired",
    );
  }

  // 3. Check Usage Limit (if maxUses is set)
  if (discount.maxUses && discount.usedCount >= discount.maxUses) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Usage limit reached for this code",
    );
  }

  // 4. Check Tier Applicability
  // If applicableTickets is empty, it applies to everything.
  // Otherwise, the selected tier must be in the list.
  if (
    discount.applicableTickets &&
    discount.applicableTickets.length > 0 &&
    !discount.applicableTickets.includes(tierName)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This code is not valid for ${tierName} tickets`,
    );
  }

  return discount;
};

/**
 * Toggles the isSoldOut status of an event.
 * Checks for organizer or authorized co-organizer permissions.
 */
export const toggleEventSoldOut = async (
  eventId: string,
  userId: string,
  tierId?: string,
) => {
  // 1. Fetch the document
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  // 2. Authorization check
  const isOrganizer = event.organizer.toString() === userId;
  const isCoOrg = event.coOrganizers?.some(
    (id: any) => id.toString() === userId,
  );

  if (!isOrganizer && !isCoOrg) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You don't have permission to modify the sales status",
    );
  }

  // 3. Perform the toggle
  if (tierId) {
    // Basic way: find the tier in the array and toggle the boolean
    const tier = event.ticketTiers.id(tierId);
    if (!tier) {
      throw new AppError(httpStatus.NOT_FOUND, "Ticket tier not found");
    }
    tier.isSoldOut = !tier.isSoldOut;
  } else {
    // Global toggle
    event.isSoldOut = !event.isSoldOut;
  }

  // 4. Save the document - Mongoose handles the internal versioning
  await event.save();

  return event;
};

export const updateCoOrganizerPermissions = async (
  eventId: string,
  coOrganizerId: string,
  permissions: CoOrganizerPermission[],
  userId: string,
) => {
  // 1. Fetch event framework explicitly
  const event = await Event.findById(eventId).select("-discounts");
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event / Move not found");
  }

  // 2. Main Organizer ownership validation
  if (event.organizer.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to manage partner permissions for this event",
    );
  }

  // 3. Atomically update the internal subdocument nested permissions array array
  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: eventId,
      "coOrganizers.user": coOrganizerId,
    },
    {
      $set: {
        "coOrganizers.$.permissions": permissions,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate("coOrganizers.user", "name email image");

  if (!updatedEvent) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Target collaborator profile not linked to this event configuration",
    );
  }

  return updatedEvent;
};

export const getActiveEventsCount = async (): Promise<number> => {
  const now = new Date();

  const count = await Event.countDocuments({
    endDate: { $gte: now },
  });

  return count;
};

export const getGateControlTelemetryData = async (
  eventId: string,
  userId: string,
) => {
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid Event ID format");
  }
  const targetEventId = new Types.ObjectId(eventId);

  // 1. Fetch Event and ensure it exists
  const event = await Event.findById(targetEventId).select("-discounts");
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  // 2. Privilege Validation Guard
  const isOrganizer = event.organizer.toString() === userId;
  const isCoOrganizer = event.coOrganizers?.some((coOrg: any) => {
    const coOrgId = coOrg.user?.toString() || coOrg.toString();
    return coOrgId === userId;
  });

  if (!isOrganizer && !isCoOrganizer) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not possess security access clear privileges for this perimeter.",
    );
  }

  // 3. Fetch all tickets and live logs concurrently
  const [allTickets, scanLogs] = await Promise.all([
    Ticket.find({ event: targetEventId }).lean(),
    ScanLog.find({ event: targetEventId }).sort({ scannedAt: -1 }).lean(),
  ]);

  // Create a high-performance map lookup matching Ticket ID string -> Latest Device Fingerprint
  const ticketFingerprintMap: Record<string, string> = {};
  const ticketScanRegistry: Record<string, string[]> = {};

  scanLogs.forEach((log) => {
    const ticketIdStr = log.ticket.toString();
    const fingerprint = log.deviceFingerprint || "OFFLINE-TERM";

    // Track every device mapping that touched this ticket for collision detection
    if (!ticketScanRegistry[ticketIdStr]) {
      ticketScanRegistry[ticketIdStr] = [];
    }
    ticketScanRegistry[ticketIdStr].push(fingerprint);

    // Keep the most recent scan device identifier as primary status
    if (!ticketFingerprintMap[ticketIdStr]) {
      ticketFingerprintMap[ticketIdStr] = fingerprint;
    }
  });

  // 4. Calculate core check-in totals safely
  const totalTicketsSold = allTickets.length;

  const checkedInTickets = allTickets.filter((t) => {
    const currentStatus = String(t.status).toLowerCase();
    return (
      currentStatus === "used" ||
      currentStatus === "checked-in" ||
      currentStatus === "checked_in"
    );
  });

  const verifiedCount = checkedInTickets.length;
  const remainingCount = Math.max(0, totalTicketsSold - verifiedCount);

  // 5. Aggregate active physical devices & compile historical timelines
  const activeDevices = new Set<string>();
  const liveFeed: any[] = [];

  // Sort checked-in passes descending by recent updates
  const sortedCheckedIn = [...checkedInTickets].sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime(),
  );

  sortedCheckedIn.forEach((ticket: any) => {
    const ticketIdStr = ticket._id.toString();
    // FIXED: Resolves fingerprint straight from the ScanLog mapping table instead of the blank ticket property
    const fingerprint = ticketFingerprintMap[ticketIdStr] || "OFFLINE-TERM";
    activeDevices.add(fingerprint);

    const guestName = ticket.buyerInfo
      ? `${ticket.buyerInfo.firstName} ${ticket.buyerInfo.lastName}`
      : "Registered Guest";

    liveFeed.push({
      ticketId: ticketIdStr,
      code: ticket.checkInCode,
      guestName,
      tier: ticket.tierName || "General Admission",
      timestamp: ticket.updatedAt || Date.now(),
      deviceId: fingerprint.substring(0, 13),
    });
  });

  // 6. Multi-Device Collision Fraud Analysis Engine
  const fraudAlerts: any[] = [];

  // FIXED: Evaluates devices mapped against unique ticket IDs using real historical logs
  for (const [ticketIdStr, devices] of Object.entries(ticketScanRegistry)) {
    const uniqueDevices = new Set(devices);

    if (devices.length > 1 && uniqueDevices.size > 1) {
      const collisionTicket: any = allTickets.find(
        (t) => t._id.toString() === ticketIdStr,
      );

      if (!collisionTicket) continue;

      const guestName = collisionTicket.buyerInfo
        ? `${collisionTicket.buyerInfo.firstName} ${collisionTicket.buyerInfo.lastName}`
        : "Unknown Attendee";

      fraudAlerts.push({
        type: "DUAL_DEVICE_COLLISION",
        severity: "CRITICAL",
        code: collisionTicket.checkInCode,
        guestName,
        message: `Pass replicated! Ticket validation processed across ${uniqueDevices.size} distinct physical scanner machines.`,
        timestamp: collisionTicket.updatedAt || Date.now(),
      });
    }
  }

  fraudAlerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    summary: {
      verifiedCount,
      remainingCount,
      activeDevicesCount: activeDevices.size,
      fraudAlertsCount: fraudAlerts.length,
    },
    fraudAlerts: fraudAlerts.slice(0, 10),
    liveFeed: liveFeed.slice(0, 25),
  };
};

export const cancelEvent = async (eventId: string, userId: string) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event record not found");
  }

  const isOrganizer = event.organizer.toString() === userId;
  const isCoOrganizer = event.coOrganizers?.some(
    (id: any) => id.toString() === userId,
  );
  if (!isOrganizer && !isCoOrganizer) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Unauthorized action on this event",
    );
  }

  event.isCancelled = true;
  event.status = "cancelled";
  await event.save();

  logger.warn(
    `Event Cancelled: ID=${eventId} by User=${userId}. Ticket sales hold state: ${event.ticketsSold || 0}`,
  );

  // Cascade to future instances if it's a parent recurring template move
  if (event.isRecurring && !event.recurrence?.parentId) {
    await Event.updateMany(
      {
        "recurrence.parentId": event._id,
        startDate: { $gt: new Date() },
      },
      { $set: { isCancelled: true, status: "cancelled" } },
    );
    logger.info(
      `Cascaded cancellation status to future instances of ParentID=${event._id}`,
    );
  }

  // Fetch all active ticket holders for this event to alert them
  try {
    const activeTickets = await Ticket.find({
      event: event._id,
      status: { $ne: "refunded" },
    });

    if (activeTickets.length > 0) {
      skauteEvents.emit("event.cancelled", { event, tickets: activeTickets });
    }
  } catch (err: any) {
    logger.error(
      `Non-blocking controller failure locating ticket holder references: ${err.message}`,
    );
  }

  return event;
};

export const deleteEvent = async (eventId: string, userId: string) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event record not found");
  }

  if (event.organizer.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the primary host can permanently purge an event",
    );
  }

  // Integrity Check: Has anyone spent money or locked down a ticket tag?
  const totalTicketsSold = event.ticketsSold || 0;
  if (totalTicketsSold > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This move cannot be deleted because tickets are already checked out. Use the cancel endpoint instead to preserve accounting logs.",
    );
  }

  // Safe to remove completely since ticketsSold is 0
  await Event.findByIdAndDelete(eventId);

  // Clean up children variants if it was a parent setup
  if (event.isRecurring && !event.recurrence?.parentId) {
    await Event.deleteMany({ "recurrence.parentId": event._id });
    logger.info(
      `Purged all un-purchased child instances of ParentID=${event._id}`,
    );
  }

  logger.info(`Event Hard Deleted: ID=${eventId} by Host=${userId}`);
  return true;
};

interface ManualTicketInput {
  eventId: string;
  operatorId: string;
  firstName: string;
  lastName: string;
  email: string;
  tierId: string;
  paymentMethod: "cash" | "transfer" | "pos" | "complimentary";
}

export const issueManualComplimentaryTicket = async (
  input: ManualTicketInput,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch event asset metadata securely within this session instance
    const event = await Event.findById(input.eventId).session(session);
    if (!event) {
      throw new AppError(httpStatus.NOT_FOUND, "Skaute event asset not found.");
    }

    // 2. Authorization Check (Organizer or Authorized Partners Only)
    const isOrganizer = event.organizer.toString() === input.operatorId;
    const partnerRecord = event.coOrganizers?.find((coOrg: any) => {
      const coOrgId = coOrg.user?._id || coOrg.user?.id || coOrg.user;
      return coOrgId.toString() === input.operatorId;
    });

    const isAuthorized =
      isOrganizer || partnerRecord?.permissions?.includes("issue_refunds");
    if (!isAuthorized) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have management permissions to manually issue passes.",
      );
    }

    // 3. Resolve internal database subdocument tier configurations
    const targetTier = event.ticketTiers.find(
      (t: any) =>
        t._id?.toString() === input.tierId || t.id?.toString() === input.tierId,
    );

    if (!targetTier) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Target ticket tier profile missing.",
      );
    }

    // 4. Fire Atomic Inventory Locks (Prevents race conditions / overselling)
    const ticketPrice = await lockInventory(
      input.eventId,
      targetTier.name,
      1,
      session,
    );

    // 5. Financial Math Core (Determine values based on incoming context)
    const isComplimentary = input.paymentMethod === "complimentary";
    const totalAmount = isComplimentary ? 0 : ticketPrice;

    // Calculate your 5.5% platform commission fee if it's a paid gate sale
    const platformFee = isComplimentary ? 0 : Math.round(totalAmount * 0.055);

    // 💡 THE DEBT MAGIC: Since the host holds the physical gross cash,
    // we record your fee as a negative value against their digital account balance
    const netAmount = isComplimentary ? 0 : -platformFee;

    // 6. Generate secure check-in validation tracking strings
    const checkInCode = `SKT-MAN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const ticketCode = `REF-MAN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 7. Satisfy Schema: Build an Administrative Order Document
    const [adminOrder] = await Order.create(
      [
        {
          buyerEmail: input.email,
          event: event._id,
          tierName: targetTier.name,
          quantity: 1,
          totalAmount, // Records true ticket cost or 0 if free
          status: ORDER_STATUS.COMPLETED,
          paymentReference: ticketCode,
          paymentUrl: `offline-${input.paymentMethod}`,
          expiresAt: new Date(),
          paymentMethod: input.paymentMethod, //
          issuedBy: new mongoose.Types.ObjectId(input.operatorId),
        },
      ],
      { session },
    );

    // 8. Create the Ticket linking it straight to the new adminOrder
    const [newTicket] = await Ticket.create(
      [
        {
          event: event._id,
          owner: undefined,
          order: adminOrder._id,
          tierName: targetTier.name,
          pricePaid: totalAmount, // Stores exactly what they paid offline
          buyerInfo: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
          },
          ticketCode,
          checkInCode,
          status: "valid",
        },
      ],
      { session },
    );

    // 9. 🆕 Create Ledger Entry for Financial Auditing
    // This logs the debt safely inside your transactions collection
    await Transaction.create(
      [
        {
          user: event.organizer, // The host who now owes Skaute the commission fee
          event: event._id,
          type: "gate_sale", // Tagged to prevent standard online payout confusion
          amount: totalAmount, // Gross money collected offline by the host
          fee: platformFee, // Skaute commission earnings
          netAmount: netAmount, // Negative debt profile hook
          status: "success",
          reference: `TXN-${ticketCode}`,
          metadata: {
            isOfflineGateSale: true,
            issuedBy: input.operatorId,
            tierName: targetTier.name,
          },
        },
      ],
      { session },
    );

    // Everything matches constraints—commit transaction safely
    await session.commitTransaction();

    // 10. Fire Asynchronous Notification Side-Effects
    try {
      skauteEvents.emit("order.fulfilled", {
        order: adminOrder,
        tickets: [newTicket],
        event,
        eventImage: event.image,
        isManualPlacement: true,
      });
    } catch (emitterErr) {
      logger.error(
        `Manual placement notification broadcast error context: ${emitterErr}`,
      );
    }

    return {
      ticketId: newTicket._id,
      ticketCode: newTicket.ticketCode,
      checkInCode: newTicket.checkInCode,
      orderId: adminOrder._id,
      feeOwed: platformFee,
    };
  } catch (error: any) {
    if (session.inTransaction()) await session.abortTransaction();
    logger.error(
      `Manual Ticket Issuance Aborted: ${error.message} - Operator: ${input.operatorId}`,
    );
    throw error;
  } finally {
    await session.endSession();
  }
};
