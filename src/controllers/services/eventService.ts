import mongoose, { Types } from "mongoose";
import { CoOrganizerPermission, Event, IEvent } from "../../models/Event.js";
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
   * EVENT LOOKUP
   */
  const event = await Event.findById(eventId).populate({
    path: "coOrganizers.user",
    select: "name image email",
  });

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  }

  /**
   * AUTHORIZATION
   */
  const isOwner = event.organizer.toString() === userId;

  const isCoOrg = event.coOrganizers?.some((coOrg: any) => {
    const coOrgUserId = coOrg.user?._id
      ? coOrg.user._id.toString()
      : coOrg.user?.toString();

    return coOrgUserId === userId;
  });

  if (!isOwner && !isCoOrg) {
    throw new AppError(httpStatus.FORBIDDEN, "Unauthorized");
  }

  /**
   * ACTIVE TICKET FILTER
   * ONLY VALID + USED COUNT AS REVENUE
   */
  const activeTicketFilter = {
    event: new mongoose.Types.ObjectId(eventId),
    status: { $in: ["valid", "used"] },
  };

  /**
   * CORE METRICS
   */
  const metricsData = await Ticket.aggregate([
    {
      $match: activeTicketFilter,
    },
    {
      $group: {
        _id: null,

        // TOTAL MONEY COLLECTED
        grossRevenue: {
          $sum: "$pricePaid",
        },

        // TOTAL ACTIVE TICKETS
        totalSold: {
          $sum: 1,
        },

        // TOTAL CHECKED IN
        checkInCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "used"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const stats = metricsData[0] || {
    grossRevenue: 0,
    totalSold: 0,
    checkInCount: 0,
  };

  /**
   * PLATFORM FEE CALCULATIONS
   */
  const grossRevenue = Number(stats.grossRevenue || 0);

  const platformFeeAmount = Number(
    ((grossRevenue * SKAUTE_FEE_PERCENT) / 100).toFixed(2),
  );

  const organizerNetRevenue = Number(
    (grossRevenue - platformFeeAmount).toFixed(2),
  );

  /**
   * PAYOUTS / SETTLEMENTS
   */
  const payoutAggregation = await Payout.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(eventId),
        status: {
          $in: ["pending", "processing", "completed"],
        },
      },
    },
    {
      $group: {
        _id: null,

        totalPayoutRequested: {
          $sum: "$amount",
        },

        totalPayoutCompleted: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0],
          },
        },

        totalPendingPayouts: {
          $sum: {
            $cond: [
              {
                $in: ["$status", ["pending", "processing"]],
              },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const payoutStats = payoutAggregation[0] || {
    totalPayoutRequested: 0,
    totalPayoutCompleted: 0,
    totalPendingPayouts: 0,
  };

  /**
   * ORGANIZER AVAILABLE BALANCE
   *
   * NET REVENUE
   * - COMPLETED PAYOUTS
   * - PENDING PAYOUTS
   */
  const withdrawableBalance = Math.max(
    organizerNetRevenue -
      payoutStats.totalPayoutCompleted -
      payoutStats.totalPendingPayouts,
    0,
  );

  /**
   * SALES BY TIER
   */
  const tierStats = await Ticket.aggregate([
    {
      $match: activeTicketFilter,
    },
    {
      $group: {
        _id: "$tierName",

        sold: {
          $sum: 1,
        },

        grossRevenue: {
          $sum: "$pricePaid",
        },
      },
    },
  ]);

  const salesByTier = event.ticketTiers.map((tier: any) => {
    const stat = tierStats.find((s) => s._id === tier.name);

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
   * ATTENDEES PAGINATION
   */
  const skip = (page - 1) * limit;

  const [attendees, totalCount] = await Promise.all([
    Ticket.find({ event: eventId })
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .populate("owner", "name image")
      .populate("checkedInBy", "name image")
      .lean(),

    Ticket.countDocuments({ event: eventId }),
  ]);

  /**
   * FINAL RESPONSE
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
      /**
       * ATTENDANCE
       */
      totalTicketsSold: stats.totalSold,
      checkInCount: stats.checkInCount,

      /**
       * MONEY
       */
      grossRevenue,

      platformFeePercent: SKAUTE_FEE_PERCENT,

      platformFeeAmount,

      organizerNetRevenue,

      /**
       * PAYOUTS
       */
      totalPayoutRequested: payoutStats.totalPayoutRequested,

      totalPayoutCompleted: payoutStats.totalPayoutCompleted,

      totalPendingPayouts: payoutStats.totalPendingPayouts,

      withdrawableBalance,

      /**
       * BREAKDOWN
       */
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
