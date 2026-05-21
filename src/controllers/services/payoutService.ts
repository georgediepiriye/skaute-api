import httpStatus from "http-status";
import AppError from "../../utils/AppError.js";
import { Event } from "../../models/Event.js";
import { Payout } from "../../models/Payout.js";
import { Ticket } from "../../models/Ticket.js";

interface BankDetailsPayload {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/**
 * Validates structural fund state balances and secures a recorded ledger intent entry
 */
export const createPayoutInstruction = async (
  userId: string,
  eventId: string,
  amount: number,
  bankDetails: BankDetailsPayload,
) => {
  // 1. Locate structural event scope
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Target event entity not found.");
  }

  // 2. Security Guard: Enforce strict host-only access (Exclude sub-scanners/co-organizers)
  const isMainHost = event.organizer?.toString() === userId;
  if (!isMainHost) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Action restricted. Only the primary event host can execute settlement operations.",
    );
  }

  // 3. Compute Financial Statements Real-Time Core Accumulations
  // Aggregate absolute gross revenue from un-refunded valid tickets
  const aggregateRevenue = await Ticket.aggregate([
    { $match: { event: event._id, status: "valid" } }, // Matches TICKET_STATUS.valid configuration
    { $group: { _id: null, total: { $sum: "$pricePaid" } } },
  ]);
  const totalEarnings = aggregateRevenue[0]?.total || 0;

  // Aggregate active pending/completed prior outflows attached to this financial bucket
  const aggregatePriorPayouts = await Payout.aggregate([
    {
      $match: {
        event: event._id,
        status: { $in: ["pending", "processing", "completed"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalSettledOutflow = aggregatePriorPayouts[0]?.total || 0;

  // Resolve current withdrawable volume capacity limits
  const currentWithdrawableBalance = totalEarnings - totalSettledOutflow;

  if (amount > currentWithdrawableBalance) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Requested volume exceeds the currently available unallocated earnings pool.",
    );
  }

  // 4. Secure Transaction Log Mapping Entry Execution
  const newPayout = await Payout.create({
    organizer: userId,
    event: eventId,
    amount,
    bankDetails: {
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
    },
  });

  return newPayout;
};
