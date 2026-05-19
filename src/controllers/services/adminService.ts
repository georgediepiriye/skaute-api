import { ORDER_STATUS, TICKET_STATUS } from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import { Order } from "../../models/Order.js";
import { Ticket } from "../../models/Ticket.js";
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
  // Directly using findByIdAndUpdate since it doesn't affect lifecycle dependencies
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
