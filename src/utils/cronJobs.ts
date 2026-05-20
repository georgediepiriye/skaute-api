import mongoose from "mongoose";
import cron from "node-cron";
import { Order } from "../models/Order.js";
import { Event } from "../models/Event.js";
import { ORDER_STATUS } from "../lib/constants.js";
import { PaystackService } from "../utils/paystackServices.js";
import { fulfillOrder } from "../controllers/services/ticketService.js";
import logger from "./logger.js";

export const initInventoryCron = () => {
  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    logger.info("CRON: Waking up to reconcile and clean expired orders...");

    // ==========================================
    // PHASE 1: RECONCILE WITH PAYSTACK FIRST
    // ==========================================
    try {
      // Find orders matching the criteria BEFORE we pull them into a transaction lock
      const candidatesForAudit = await Order.find({
        status: ORDER_STATUS.PENDING,
        expiresAt: { $lt: new Date() },
      }).limit(50);

      for (const order of candidatesForAudit) {
        try {
          logger.info(
            `CRON AUDIT: Verifying status on Paystack for Ref=${order.paymentReference}`,
          );
          const paystackData = await PaystackService.verifyTransaction(
            order.paymentReference,
          );

          // If they actually successfully paid at the last second, fulfill it now!
          if (paystackData?.data?.status === "success") {
            logger.info(
              `CRON RECONCILIATION: Found paid ghost transaction! Fulfilling Ref=${order.paymentReference}`,
            );
            await fulfillOrder(
              order.paymentReference,
              paystackData.data.metadata,
              true,
            );
          }
        } catch (paystackError: any) {
          logger.error(
            `CRON AUDIT ERROR: Failed to cross-check reference ${order.paymentReference}: ${paystackError.message}`,
          );
          // We don't break the loop here; let individual order errors fail silently so others process
        }
      }
    } catch (phase1Error: any) {
      logger.error(
        `CRON PHASE 1 ERROR: Paystack audit step failed: ${phase1Error.message}`,
      );
    }

    // ==========================================
    // PHASE 2: CLEAN UP TRULY ABANDONED ORDERS
    // ==========================================
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Fetch candidate targets again (any that were fulfilled in Phase 1 are no longer PENDING)
      const expiredOrders = await Order.find({
        status: ORDER_STATUS.PENDING,
        expiresAt: { $lt: new Date() },
      })
        .limit(50)
        .session(session);

      if (expiredOrders.length === 0) {
        await session.commitTransaction();
        logger.info("CRON: No abandoned orders left to expire.");
        return;
      }

      logger.info(
        `CRON: Releasing inventory for ${expiredOrders.length} truly abandoned orders.`,
      );

      for (const order of expiredOrders) {
        // ATOMIC UPDATE: Mark the order as expired ONLY if it is still PENDING.
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            status: ORDER_STATUS.PENDING,
          },
          {
            $set: { status: ORDER_STATUS.EXPIRED },
          },
          {
            session,
            new: true,
          },
        );

        // If updatedOrder comes back null, it was concurrently changed somewhere else. Skip it safely.
        if (!updatedOrder) {
          logger.warn(
            `CRON COLLISION PREVENTED: Order ${order.paymentReference} was updated concurrently.`,
          );
          continue;
        }

        // Return the allocated ticket tier allocation back to the Event document
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
      logger.error(`CRON TRANSACTION ERROR: ${error.message}`);
    } finally {
      await session.endSession();
    }
  });
};
