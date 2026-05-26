import httpStatus from "http-status";
import AppError from "../../utils/AppError.js";
import { Event } from "../../models/Event.js";
import { Payout } from "../../models/Payout.js";
import { Ticket } from "../../models/Ticket.js";
import config from "../../config/config.js";

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
  const SKAUTE_FEE_PERCENT = Number(config.skauteFeePercent) || 5.5;

  /**
   * =========================================
   * EVENT LOOKUP
   * =========================================
   */
  const event = await Event.findById(eventId);

  if (!event) {
    throw new AppError(httpStatus.NOT_FOUND, "Target event entity not found.");
  }

  /**
   * =========================================
   * SECURITY CHECK
   * ONLY MAIN ORGANIZER CAN WITHDRAW
   * =========================================
   */
  const isMainHost = event.organizer?.toString() === userId;

  if (!isMainHost) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Action restricted. Only the primary event host can execute settlement operations.",
    );
  }

  /**
   * =========================================
   * VALIDATION
   * =========================================
   */
  if (!amount || amount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payout amount.");
  }

  /**
   * =========================================
   * REVENUE CALCULATION
   * ONLY VALID + USED TICKETS COUNT
   * =========================================
   */
  const revenueAggregation = await Ticket.aggregate([
    {
      $match: {
        event: event._id,
        status: {
          $in: ["valid", "used"],
        },
      },
    },
    {
      $group: {
        _id: null,

        grossRevenue: {
          $sum: "$pricePaid",
        },
      },
    },
  ]);

  const grossRevenue = Number(revenueAggregation[0]?.grossRevenue || 0);

  /**
   * =========================================
   * PLATFORM FEE
   * =========================================
   *
   * IMPORTANT:
   * 5.5% of ₦20,000 = ₦1,100
   *
   * Formula:
   * grossRevenue * (5.5 / 100)
   */
  const platformFeeAmount = Number(
    (grossRevenue * (SKAUTE_FEE_PERCENT / 100)).toFixed(2),
  );

  /**
   * =========================================
   * ORGANIZER NET REVENUE
   * =========================================
   */
  const organizerNetRevenue = Number(
    (grossRevenue - platformFeeAmount).toFixed(2),
  );

  /**
   * =========================================
   * PRIOR PAYOUTS
   * INCLUDE:
   * - pending
   * - processing
   * - completed
   * =========================================
   */
  const payoutAggregation = await Payout.aggregate([
    {
      $match: {
        event: event._id,

        status: {
          $in: ["pending", "processing", "completed"],
        },
      },
    },
    {
      $group: {
        _id: null,

        totalPayouts: {
          $sum: "$amount",
        },
      },
    },
  ]);

  const totalPayouts = Number(payoutAggregation[0]?.totalPayouts || 0);

  /**
   * =========================================
   * WITHDRAWABLE BALANCE
   * =========================================
   */
  const withdrawableBalance = Math.max(organizerNetRevenue - totalPayouts, 0);

  /**
   * =========================================
   * BALANCE CHECK
   * =========================================
   */
  if (amount > withdrawableBalance) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient withdrawable balance. Available balance is ₦${withdrawableBalance.toLocaleString()}.`,
    );
  }

  /**
   * =========================================
   * CREATE PAYOUT RECORD
   * =========================================
   */
  const newPayout = await Payout.create({
    organizer: userId,

    event: eventId,

    amount,

    bankDetails: {
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
    },

    status: "pending",
  });

  /**
   * =========================================
   * RETURN
   * =========================================
   */
  return {
    payout: newPayout,

    financials: {
      grossRevenue,

      platformFeePercent: SKAUTE_FEE_PERCENT,

      platformFeeAmount,

      organizerNetRevenue,

      totalPayouts,

      withdrawableBalance: withdrawableBalance - amount,
    },
  };
};

export const getPayoutsByOrganizer = async (userId: string) => {
  return await Payout.find({ organizer: userId })
    .sort({ requestedAt: -1, createdAt: -1 })
    .populate("event", "title slug");
};
