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
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  // We use an aggregation or virtuals if you want the event count,
  // but for a straightforward start, we find and populate:
  const users = await User.find()
    .select("name email role isVerified createdAt")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments();

  // If you need the 'eventsCount' field your frontend table expects,
  // you can map the results or use MongoDB $lookup aggregation.
  return { users, total };
};

/**
 * Aggregates analytics using actual Order and Ticket schema fields
 */
export const getPulseMetrics = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [neighborhoodHeat, ticketVelocity, financialOverview, checkInStats] =
    await Promise.all([
      // 1. NEIGHBORHOOD HEAT (Signups by PH Location)
      User.aggregate([
        { $match: { neighborhood: { $exists: true, $ne: null } } },
        { $group: { _id: "$neighborhood", signups: { $sum: 1 } } },
        { $sort: { signups: -1 } },
        { $limit: 10 },
      ]),

      // 2. TICKET VELOCITY (Orders using your 'totalAmount' and 'quantity' fields)
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo },
            status: "paid", // Using your OrderStatus enum logic
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            orders: { $sum: 1 },
            ticketsSold: { $sum: "$quantity" },
            revenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 3. FINANCIAL OVERVIEW (Pending vs Paid)
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            total: { $sum: "$totalAmount" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 4. REAL-TIME VIBE (Check-ins from Ticket Schema)
      Ticket.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  return {
    neighborhoods: neighborhoodHeat.map((n: { _id: any; signups: any }) => ({
      name: n._id,
      signups: n.signups,
    })),
    velocity: ticketVelocity,
    finances: {
      totalRevenue:
        financialOverview.find((f: { _id: string }) => f._id === "paid")
          ?.total || 0,
      pendingAmount:
        financialOverview.find((f: { _id: string }) => f._id === "pending")
          ?.total || 0,
    },
    engagement: {
      totalTickets: checkInStats.reduce(
        (acc: any, curr: { count: any }) => acc + curr.count,
        0,
      ),
      checkedIn:
        checkInStats.find((s: { _id: string }) => s._id === "used")?.count || 0,
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
