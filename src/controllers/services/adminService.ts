import mongoose from "mongoose";
import {
  ORDER_STATUS,
  SCAN_LOG_STATUS,
  TICKET_STATUS,
} from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import { Order } from "../../models/Order.js";
import { Payout } from "../../models/Payout.js";
import { ScanLog } from "../../models/ScanLog.js";
import { Ticket } from "../../models/Ticket.js";
import { Transaction } from "../../models/Transaction.js";
import { User } from "../../models/User.js";

export const getModerationQueue = async (query: any) => {
  // 1. FILTERING
  const queryObj = { ...query };
  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  const filter = { ...queryObj };
  if (!filter.approvalStatus) filter.approvalStatus = "pending";

  if (filter.title) filter.title = { $regex: filter.title, $options: "i" };
  if (filter.neighborhood)
    filter["location.neighborhood"] = filter.neighborhood;

  // 2. DATA FETCHING (CURRENT VIEW)
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  let dbQuery = Event.find(filter)
    .populate("organizer", "name image email")
    .sort(query.sort ? query.sort.split(",").join(" ") : "-createdAt")
    .skip(skip)
    .limit(limit);

  // 3. EXECUTE PARALLEL QUERIES
  // We fetch the current page of events AND all status counts simultaneously
  const [
    events,
    totalEvents,
    pendingCount,
    approvedCount,
    rejectedCount,
    grandTotal,
  ] = await Promise.all([
    dbQuery,
    Event.countDocuments(filter), // Total for the current filtered view
    Event.countDocuments({ approvalStatus: "pending" }),
    Event.countDocuments({ approvalStatus: "approved" }),
    Event.countDocuments({ approvalStatus: "rejected" }),
    Event.countDocuments({}), // Grand total of all events
  ]);

  return {
    events,
    pagination: {
      totalEvents, // Total for the current filter (used for pagination)
      totalPages: Math.ceil(totalEvents / limit),
      page,
      limit,
      // Metadata for your dashboard stat cards
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        all: grandTotal,
      },
    },
  };
};

export const getEventForPreview = async (id: string) => {
  const event = await Event.findById(id).populate("organizer");
  return event;
};

export const updateApprovalStatus = async (id: string, status: string) => {
  const updateData: any = { approvalStatus: status };

  if (status === "approved") {
    updateData.isActive = true;
    updateData.publishedAt = Date.now();
  }

  const event = await Event.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  return event;
};

export const getUsersList = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // 1. DYNAMIC SEARCH & FILTER MATRIX
  const filter: any = {};

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  // 2. PARALLEL RESOLUTION WITH AGGREGATION LOOKUP
  // We use an aggregation pipeline to compute matching users along with their total hosted event counts
  const [
    aggregatedUsers,
    totalUsersCount,
    activeCount,
    suspendedCount,
    pendingCount,
  ] = await Promise.all([
    User.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "events", // Looks up your collection name for Events
          localField: "_id",
          foreignField: "organizer",
          as: "hostedEvents",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          status: 1,
          isVerified: 1,
          createdAt: 1,
          eventsCount: { $size: "$hostedEvents" }, // Calculates dynamic value for frontend tables
        },
      },
    ]),
    User.countDocuments(filter),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "suspended" }),
    User.countDocuments({ status: "pending" }),
  ]);

  return {
    users: aggregatedUsers,
    pagination: {
      totalUsers: totalUsersCount,
      totalPages: Math.ceil(totalUsersCount / limit),
      page,
      limit,
      counts: {
        all: activeCount + suspendedCount + pendingCount,
        active: activeCount,
        suspended: suspendedCount,
        pending: pendingCount,
      },
    },
  };
};

/**
 * Updates a user's operational state status ("active" | "suspended")
 */
export const updateUserStatus = async (
  id: string,
  status: "active" | "suspended",
) => {
  const user = await User.findById(id);
  if (!user) return null;

  user.status = status;
  // Trigger userSchema's .pre("save") hook to automatically sync the hidden "active" boolean
  await user.save();

  return user;
};

/**
 * Updates an organizer's verification status
 */
export const updateUserVerification = async (
  id: string,
  isVerified: boolean,
) => {
  const user = await User.findByIdAndUpdate(
    id,
    { isVerified },
    { new: true, runValidators: true },
  ).select("name email role isVerified status createdAt");

  return user;
};

/**
 * Aggregates production-grade operational metrics tailored precisely to your
 * native Order, Event, and Ticket schema specifications.
 */
export const getPulseMetrics = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Kivo Platform Business Core Mechanics: 10% Platform Commission
  const PLATFORM_COMMISSION_RATE = 0.1;

  const [
    neighborhoodHeat,
    ticketVelocity,
    financialOverview,
    gateCheckInStats,
    pendingModerationCount,
    unverifiedOrganizersCount,
    cancelledEventsCount,
  ] = await Promise.all([
    // 1. NEIGHBORHOOD SIGNUPS (User Location Footprint)
    User.aggregate([
      { $match: { neighborhood: { $exists: true, $ne: null } } },
      { $group: { _id: "$neighborhood", signups: { $sum: 1 } } },
      { $sort: { signups: -1 } },
      { $limit: 10 },
    ]),

    // 2. TICKET VELOCITY (7-Day Sales Curve mapped to order quantities)
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: ORDER_STATUS.COMPLETED, // Evaluates to 'completed'
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          tickets: { $sum: "$quantity" },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 3. FINANCIAL OVERVIEW (Gross Processing Splits)
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 4. REAL-TIME GATE ADMITTANCE (Using structural checkedInAt properties)
    Ticket.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ["$checkedInAt", false] },
              "scanned",
              "unscanned",
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // 5. ESCALATION 1: Moves awaiting administrative review
    Event.countDocuments({ approvalStatus: "pending" }),

    // 6. ESCALATION 2: Unverified Organizers
    // Maps to your User model's verification checks for platform trust parameters
    User.countDocuments({ role: "organizer", isVerified: false }),

    // 7. ESCALATION 3: Flagged/Cancelled Moves that need remediation audit
    Event.countDocuments({ isCancelled: true }),
  ]);

  // Safe Financial Matrix Destructuring
  const grossCompletedRevenue =
    financialOverview.find((f) => f._id === ORDER_STATUS.COMPLETED)?.total || 0;

  // Platform Split Engine Mechanics
  const platformEarnings = grossCompletedRevenue * PLATFORM_COMMISSION_RATE;
  const clearOrganizerEscrowPool = grossCompletedRevenue - platformEarnings;

  // Safe Check-In Parsing
  const totalTicketsDistributed = gateCheckInStats.reduce(
    (acc, curr) => acc + curr.count,
    0,
  );
  const totalCheckedIn =
    gateCheckInStats.find((s) => s._id === "scanned")?.count || 0;

  return {
    neighborhoods: neighborhoodHeat.map((n: { _id: any; signups: any }) => ({
      name: n._id,
      signups: n.signups,
    })),

    velocity: ticketVelocity.map((v) => ({
      _id: v._id,
      orders: v.orders,
      tickets: v.tickets,
      revenue: v.revenue,
    })),

    finances: {
      totalRevenue: grossCompletedRevenue, // Platform Gross Processing Volume (GMV)
      pendingAmount: clearOrganizerEscrowPool, // Escrow balance to allocate to organizers
      platformCommission: platformEarnings, // Kivo Net Take-Rate Earnings
    },

    engagement: {
      totalTickets: totalTicketsDistributed,
      checkedIn: totalCheckedIn,
    },

    escalations: {
      pendingModerationCount,
      unverifiedOrganizersCount,
      activeDisputesCount: cancelledEventsCount, // Re-routed to track cancelled items requiring automated processing
    },
  };
};

/**
 * Aggregates production-grade management data for an event.
 */
export const getEventManagementDetails = async (eventId: string) => {
  const [event, orders, tickets] = await Promise.all([
    // 1. Fetch core event and host details
    Event.findById(eventId).populate("organizer", "name email image"),

    // 2. Fetch successful transactions only
    Order.find({
      event: eventId,
      status: ORDER_STATUS.COMPLETED, // Aligned with your provided constant
    })
      .sort("-createdAt")
      .populate("user", "name email"),

    // 3. Fetch all issued tickets for engagement tracking
    Ticket.find({ event: eventId }).sort("-createdAt"),
  ]);

  if (!event) return null;

  // 4. Calculate Operational Analytics
  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );

  // Identify check-ins based on your Ticket schema status
  const checkedInCount = tickets.filter(
    (t) => t.status === TICKET_STATUS.used,
  ).length;

  return {
    event,
    orders,
    tickets,
    analytics: {
      totalRevenue,
      totalTicketsSold: tickets.length,
      checkInCount: checkedInCount,
      checkInRate:
        tickets.length > 0
          ? Math.round((checkedInCount / tickets.length) * 100)
          : 0,
      capacityUtilization: event.totalCapacity
        ? Math.round((tickets.length / event.totalCapacity) * 100)
        : 100,
    },
  };
};

/**
 * Mutates discovery engine parameters and forces a recalculation of priority fields
 */
export const updateEventPromotionStatus = async (
  id: string,
  adminId: string,
  promotionData: any,
) => {
  const event = await Event.findById(id);
  if (!event) return null;

  // 1. Handle Status Array Updates ("verified", "featured")
  if (promotionData.statusArray !== undefined) {
    const oldStatus = [...event.status];
    event.status = promotionData.statusArray;

    // Track operational timestamps for record-keeping
    if (
      promotionData.statusArray.includes("verified") &&
      !oldStatus.includes("verified")
    ) {
      event.verifiedAt = new Date();
    }
    if (
      promotionData.statusArray.includes("featured") &&
      !oldStatus.includes("featured")
    ) {
      event.featuredAt = new Date();
    }
  }

  // 2. Handle Skaute Hosted Flag Toggle
  if (promotionData.isSkauteHosted !== undefined) {
    event.isSkauteHosted = promotionData.isSkauteHosted;
  }

  // 3. Handle Commercial Boosting Pipeline
  if (promotionData.isBoosted !== undefined) {
    event.isBoosted = promotionData.isBoosted;

    if (promotionData.isBoosted) {
      event.boostTier = promotionData.boostTier || "standard";
      event.boostedBy = adminId;

      // Compute future expiration date (defaults to 7 days if not provided)
      const days = Number(promotionData.boostDays) || 7;
      event.boostExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      // Clear boost metadata if stripped
      event.boostTier = "none";
      event.boostExpiry = undefined;
      event.boostedBy = undefined;
    }
  }

  // 4. Critical Step: Save document instance to trigger .pre("save") hook calculation
  await event.save();
  return event;
};

export const getPayoutsList = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // 1. DYNAMIC FILTER MATRIX
  const filter: any = {};
  if (query.status) filter.status = query.status; // "pending" | "completed"

  // 2. CONCURRENT DATA & STAT COUNT RESOLUTION
  const [payouts, totalPayoutsCount] = await Promise.all([
    Payout.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payout.countDocuments(filter),
  ]);

  return {
    payouts,
    pagination: {
      totalPayouts: totalPayoutsCount,
      totalPages: Math.ceil(totalPayoutsCount / limit),
      page,
      limit,
    },
  };
};

export const processManualPayoutCompletion = async (
  id: string,
  reference: string,
) => {
  const payout = await Payout.findOne({ _id: id, status: "pending" });
  if (!payout) return null;

  // 1. Update status tracking attributes
  payout.status = "completed";
  payout.paymentReference = reference;
  payout.paidAt = new Date();

  await payout.save();
  await Transaction.create({
    organizer: payout.organizer,
    amount: payout.amount,
    type: "payout",
    status: "success",
    reference: reference,
    description: `Manual balance settlement clearance transfer to ${payout.bankDetails.accountName}`,
  });

  return payout;
};

export const getGateTelemetry = async (query: any) => {
  // Aggregate real-time validation actions across active event spaces using ScanLog
  const aggregateLogs = await ScanLog.aggregate([
    {
      $match: {
        status: SCAN_LOG_STATUS.SUCCESS, // Tracks valid admissions
      },
    },
    {
      $group: {
        _id: "$event",
        totalScans: { $sum: 1 },
        lastScanTime: { $max: "$scannedAt" },
      },
    },
    { $sort: { lastScanTime: -1 } },
    { $limit: 20 },
  ]);

  return await Event.populate(aggregateLogs, {
    path: "_id",
    select: "title location organizer",
  });
};

export const getTelemetryDataset = async (eventId?: string) => {
  const filter: any = {};
  if (eventId) {
    filter.event = new mongoose.Types.ObjectId(eventId);
  }

  // 1. Resolve general counts concurrently
  const [totalTicketsCount, checkedInCount] = await Promise.all([
    Ticket.countDocuments(eventId ? { event: eventId } : {}),
    Ticket.countDocuments({
      ...(eventId ? { event: eventId } : {}),
      status: TICKET_STATUS.used,
    }),
  ]);

  // 2. Query ScanLogs to pull deep live feeds, terminal state statistics, and exceptions
  const [recentLogs, terminalAggregation, fraudLogs] = await Promise.all([
    // Live feed pipeline: Includes ticket metadata payloads by populating the referenced doc
    ScanLog.find({ ...filter, status: SCAN_LOG_STATUS.SUCCESS })
      .sort("-scannedAt")
      .limit(50)
      .populate("ticket", "buyerInfo tierName checkInCode")
      .populate("scanner", "name email") // Populates who checked it in
      .lean(),

    // Target terminal hardware device counters
    ScanLog.aggregate([
      {
        $match: {
          ...filter,
          deviceFingerprint: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$deviceFingerprint",
          scanCount: { $sum: 1 },
          lastActive: { $max: "$scannedAt" },
          // Pulls the name of the last staff user who operated this device fingerprint
          lastOperatorId: { $last: "$scanner" },
        },
      },
    ]),

    // Pull collision anomalies to process into the active threat array
    ScanLog.find({
      ...filter,
      status: {
        $in: [SCAN_LOG_STATUS.DUPLICATE, SCAN_LOG_STATUS.INVALID_EVENT],
      },
    })
      .sort("-scannedAt")
      .limit(30)
      .populate("ticket", "buyerInfo checkInCode")
      .lean(),
  ]);

  // 3. Hydrate Terminal Operator identities if active hardware is detected
  let terminals: any[] = [];
  if (terminalAggregation.length > 0) {
    terminals = await Event.populate(terminalAggregation, {
      path: "lastOperatorId",
      model: "User",
      select: "name",
    });

    terminals = terminals.map((term: any) => ({
      deviceId: term._id ? String(term._id).substring(0, 13) : "UNKNOWN-HWID",
      operatorName: term.lastOperatorId?.name || "Gate Staff",
      scanCount: term.scanCount || 0,
      status:
        Date.now() - new Date(term.lastActive).getTime() < 10 * 60 * 1000
          ? "online"
          : "offline",
    }));
  }

  // 4. Transform native logs into cleanly mapped live analytics outputs
  const liveFeed = recentLogs.map((log: any) => {
    const t = log.ticket;
    return {
      ticketId: t?._id?.toString() || log.ticket?.toString(),
      guestName: t?.buyerInfo
        ? `${t.buyerInfo.firstName} ${t.buyerInfo.lastName}`
        : "Registered Guest",
      tier: t?.tierName || "Standard Access",
      code: t?.checkInCode || "VERIFIED",
      deviceId: log.deviceFingerprint
        ? String(log.deviceFingerprint).substring(0, 13)
        : "OFFLINE-TERM",
      timestamp: log.scannedAt,
    };
  });

  // 5. Structure active threat parameters into fraud panels
  const fraudAlerts = fraudLogs.map((log: any) => {
    const t = log.ticket;
    return {
      type: log.status,
      severity:
        log.status === SCAN_LOG_STATUS.DUPLICATE ? "CRITICAL" : "MEDIUM",
      code: t?.checkInCode || "UNKNOWN_CODE",
      guestName: t?.buyerInfo
        ? `${t.buyerInfo.firstName} ${t.buyerInfo.lastName}`
        : "Unknown Attendee",
      message:
        log.status === SCAN_LOG_STATUS.DUPLICATE
          ? "Ticket duplication alert! Ticket reuse attempt rejected at gateway terminal."
          : "Cross-venue scan mismatch! This pass belongs to an entirely different event perimeter.",
      timestamp: log.scannedAt,
    };
  });

  // 6. Sliding Entry Velocity calculation
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyLogsCount = await ScanLog.countDocuments({
    ...filter,
    status: SCAN_LOG_STATUS.SUCCESS,
    scannedAt: { $gte: oneHourAgo },
  });
  const scansPerMinute = Math.ceil(hourlyLogsCount / 60) || 0;

  return {
    summary: {
      verifiedCount: checkedInCount,
      totalTicketsSold: totalTicketsCount,
      activeDevicesCount: terminals.filter((t) => t.status === "online").length,
      scansPerMinute,
      fraudAlertsCount: fraudAlerts.length,
    },
    terminals,
    fraudAlerts,
    liveFeed,
  };
};
