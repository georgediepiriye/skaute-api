import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import AppError from "../utils/AppError.js";
import * as payoutService from "./services/payoutService.js";

/**
 * @desc    File a manual banking settlement payout request instruction
 * @route   POST /v1/payouts/request
 * @access  Private (Main Event Organizer Only)
 */
export const requestPayout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { eventId, amount, bankDetails } = req.body;
    const userId = (req.user as any)?.id?.toString();

    // 1. Structural Validation Guards
    if (!eventId || !amount || !bankDetails) {
      return next(
        new AppError(
          httpStatus.BAD_REQUEST,
          "All structural ledger parameters and billing destinations are required.",
        ),
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 100) {
      return next(
        new AppError(
          httpStatus.BAD_REQUEST,
          "Minimum platform payout threshold configuration is ₦100.",
        ),
      );
    }

    if (
      !bankDetails.bankName ||
      !bankDetails.accountNumber ||
      !bankDetails.accountName
    ) {
      return next(
        new AppError(
          httpStatus.BAD_REQUEST,
          "Complete destination bank coordinates are required.",
        ),
      );
    }

    const payout = await payoutService.createPayoutInstruction(
      userId,
      eventId as string,
      parsedAmount,
      {
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
      },
    );

    // 3. Respond cleanly using your established signature
    res.status(httpStatus.CREATED).json({
      status: "success",
      message:
        "Settlement instruction logged securely. Processing verification queued.",
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};
