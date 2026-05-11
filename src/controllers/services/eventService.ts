import mongoose from "mongoose";
import { Event, IEvent } from "../../models/Event.js";
import { Ticket } from "../../models/Ticket.js";
import { User } from "../../models/User.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";
import httpStatus from "http-status";

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

/**
 * Kivo Discovery Engine: getAllEvents
 * Handles additive priority sorting, location-based discovery in Port Harcourt,
 * and precise date/time filtering for live and upcoming events.
 */
export const getAllEvents = async (query: any) => {
  const queryObj = { ...query };

  // Fields to exclude from direct object matching
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
  ];
  excludedFields.forEach((el) => delete queryObj[el]);

  // Initial filter with base business rules
  let filter: any = {
    ...queryObj,
    approvalStatus: "approved",
    isCancelled: false,
  };

  // 1. TEXT SEARCH & MULTI-CATEGORY
  if (filter.title) filter.title = { $regex: filter.title, $options: "i" };
  if (queryObj.category?.includes(",")) {
    filter.category = { $in: queryObj.category.split(",") };
  }

  const now = new Date();

  // 2. REFINED BOOSTING & PRIORITY LOGIC
  // If explicitly searching for boosted, check expiry.
  // Otherwise, we let the Sort Engine handle the visibility.
  if (query.isBoosted === "true") {
    filter.isBoosted = true;
    filter.boostExpiry = { $gt: now };
  }

  // 3. TIME STATUS LOGIC (Live vs Upcoming)
  if (query.timeStatus === "live") {
    filter.startDate = { $lte: now };
    filter.endDate = { $gte: now };
  } else if (query.timeStatus === "upcoming") {
    filter.startDate = { $gt: now };
  }

  // 4. DATE RANGE LOGIC
  if (query["startDate[lte]"] || query["endDate[gte]"]) {
    const dateQuery: any = {};
    if (query["startDate[lte]"])
      dateQuery.$lte = new Date(query["startDate[lte]"]);

    if (query["endDate[gte]"]) {
      // Corrected logic: Ensure we don't overwrite filter.startDate if it exists
      filter.startDate = { ...(filter.startDate || {}), ...dateQuery };
      filter.endDate = {
        ...(filter.endDate || {}),
        $gte: new Date(query["endDate[gte]"]),
      };
    }
  }

  // 5. PHYSICAL VS VIRTUAL LOGIC
  if (query.eventFormat) {
    if (query.eventFormat === "online") {
      filter.eventFormat = { $in: ["online", "hybrid"] };
    } else if (query.eventFormat === "physical") {
      filter.eventFormat = { $in: ["physical", "hybrid"] };
    }
  }

  // 6. GEO-SPATIAL LOGIC (Focusing on Port Harcourt radius)
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

  // 7. BUILD QUERY
  let dbQuery = Event.find(filter).populate({
    path: "organizer",
    select: "name image location role",
  });

  /**
   * 8. THE DISCOVERY ENGINE (The Fix)
   * We want Priority 5 to be the absolute master.
   * Boosted status is the secondary driver.
   */
  if (query.sort) {
    // Allows API consumers to override if they specifically ask for "newest"
    dbQuery = dbQuery.sort(query.sort.split(",").join(" "));
  } else {
    dbQuery = dbQuery.sort({
      priorityLevel: -1, // 1. Absolute highest rank (5 > 3 > 1)
      isBoosted: -1, // 2. Paid boosts within those ranks
      startDate: 1, // 3. Happening soonest
      createdAt: -1, // 4. Newest entries
    });
  }

  // 9. PAGINATION & EXECUTION
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  // Run total count and data fetch in parallel for performance
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
  const event = await Event.findById(id).populate({
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
  // 1. Fetch Event with Auth Check
  const event = await Event.findById(eventId).populate(
    "coOrganizers",
    "name image email",
  );

  if (!event) throw new Error("Event not found");

  const isOwner = event.organizer.toString() === userId;
  const isCoOrg = event.coOrganizers?.some(
    (coOrg: any) => coOrg._id.toString() === userId,
  );

  if (!isOwner && !isCoOrg) throw new Error("Unauthorized");

  // 2. Metrics Calculation (Optimized Aggregation)
  // Instead of fetching all docs, we let MongoDB do the math.
  const metricsData = await Ticket.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(eventId),
        status: { $in: ["valid", "used"] },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricePaid" },
        totalSold: { $sum: 1 },
        checkInCount: {
          $sum: { $cond: [{ $eq: ["$status", "used"] }, 1, 0] },
        },
      },
    },
  ]);

  const stats = metricsData[0] || {
    totalRevenue: 0,
    totalSold: 0,
    checkInCount: 0,
  };

  // 3. Sales By Tier (Using your schema's tierName)
  const tierStats = await Ticket.aggregate([
    {
      $match: {
        event: new mongoose.Types.ObjectId(eventId),
        status: { $in: ["valid", "used"] },
      },
    },
    {
      $group: {
        _id: "$tierName",
        sold: { $sum: 1 },
        revenue: { $sum: "$pricePaid" },
      },
    },
  ]);

  // Map aggregation results back to event tiers to include capacity
  const salesByTier = event.ticketTiers.map((tier: any) => {
    const stat = tierStats.find((s) => s._id === tier.name);
    return {
      name: tier.name,
      sold: stat?.sold || 0,
      capacity: tier.capacity,
      revenue: stat?.revenue || 0,
    };
  });

  // 4. Paginated Attendees
  const skip = (page - 1) * limit;

  const [attendees, totalCount] = await Promise.all([
    Ticket.find({ event: eventId, status: { $in: ["valid", "used"] } })
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .populate("owner", "name image")
      .lean(), // Use lean for faster read-only queries
    Ticket.countDocuments({
      event: eventId,
      status: { $in: ["valid", "used"] },
    }),
  ]);

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
      totalRevenue: stats.totalRevenue,
      totalTicketsSold: stats.totalSold,
      checkInCount: stats.checkInCount,
      salesByTier,
    },
  };
};

export const addPartnerToEvent = async (
  eventId: string,
  email: string,
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
      "User not found. They must sign up on Kivo first.",
    );
  }

  if (userToAdd._id.toString() === event.organizer.toString()) {
    throw new AppError(httpStatus.BAD_REQUEST, "You are already the host");
  }

  const alreadyPartner = event.coOrganizers?.some(
    (id: { toString: () => any }) => id.toString() === userToAdd._id.toString(),
  );
  if (alreadyPartner) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This user is already a partner",
    );
  }

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    { $addToSet: { coOrganizers: userToAdd._id } },
    { new: true, runValidators: true },
  );

  logger.info(`Partner Added: EventID=${eventId} Partner=${email}`);

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
  // Co-organizers should not be able to remove each other
  if (event.organizer.toString() !== organizerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the main host has permission to remove partners",
    );
  }

  // 3. Update the event using $pull
  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    { $pull: { coOrganizers: partnerId } },
    { new: true, runValidators: true },
  ).populate("coOrganizers", "name image email");

  logger.info(`Partner Removed: EventID=${eventId} PartnerID=${partnerId}`);

  return updatedEvent;
};

export const getEventBySlug = async (slug: string) => {
  const event = await Event.findOne({
    slug: slug,
  }).populate({
    path: "organizer",
    select: "name image location",
  });

  return event;
};
