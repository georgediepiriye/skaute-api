import mongoose from "mongoose";
import cron from "node-cron";
import { Order } from "../models/Order.js";
import { Event } from "../models/Event.js";
import { ORDER_STATUS } from "../lib/constants.js";
import logger from "../utils/logger.js";

export const initInventoryCron = () => {
  // Runs every 5 minutes
  // Minute | Hour | DayOfMonth | Month | DayOfWeek
  cron.schedule("*/5 * * * *", async () => {
    logger.info("CRON: Checking for expired pending orders...");

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Fetch expired candidate targets using the status + expiresAt compound index
      // We process in batches of 50 to keep transaction locks minimal and quick
      const expiredOrders = await Order.find({
        status: ORDER_STATUS.PENDING,
        expiresAt: { $lt: new Date() },
      })
        .limit(50)
        .session(session);

      if (expiredOrders.length === 0) {
        // Safe exit: Commit the empty read transaction cleanly
        await session.commitTransaction();
        return;
      }

      logger.info(
        `CRON: Attempting to release inventory for ${expiredOrders.length} candidate orders.`,
      );

      for (const order of expiredOrders) {
        // 2. ATOMIC UPDATE: Mark the order as expired ONLY if it is still PENDING.
        // This stops Paystack webhook processing collisions dead in their tracks.
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            status: ORDER_STATUS.PENDING, // Core concurrency guard
          },
          {
            $set: { status: "expired" },
          },
          {
            session,
            new: true,
          },
        );

        // If updatedOrder comes back null, it means Paystack fulfilled it in the last few milliseconds.
        // Skip it safely so we do not steal the user's inventory!
        if (!updatedOrder) {
          logger.warn(
            `CRON COLLISION PREVENTED: Order ${order.paymentReference} was completed concurrently.`,
          );
          continue;
        }

        // 3. Return the allocated ticket tier allocation back to the Event document
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

        logger.info(
          `CRON: Successfully released ${order.quantity} tickets for Event: ${order.event}`,
        );
      }

      await session.commitTransaction();
      logger.info("CRON: Inventory cleanup completed successfully.");
    } catch (error: any) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      logger.error(`CRON ERROR: ${error.message}`);
    } finally {
      await session.endSession();
    }
  });
};
