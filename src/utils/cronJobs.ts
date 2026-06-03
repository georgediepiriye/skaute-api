import mongoose from "mongoose";
import cron from "node-cron";
import { Order } from "../models/Order.js";
import { Event } from "../models/Event.js";
import { ORDER_STATUS } from "../lib/constants.js";
import { PaystackService } from "../utils/paystackServices.js";
import { fulfillOrder } from "../controllers/services/ticketService.js";
import logger from "./logger.js";
import Hotspot from "../models/Hotspot.js";
import { getIO } from "../socket.js";

export const initInventoryCron = () => {
  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    logger.info("CRON: Waking up to reconcile and clean expired orders...");

    // ==========================================
    // PHASE 1: RECONCILE WITH PAYSTACK FIRST
    // ==========================================
    try {
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

      // Fetch fresh candidate targets that didn't get fulfilled during Phase 1
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
        `CRON: Processing inventory release for ${expiredOrders.length} orders.`,
      );

      const orderBulkOps = [];
      const eventBulkOps = [];

      for (const order of expiredOrders) {
        // Prepare atomic switch for order statuses
        orderBulkOps.push({
          updateOne: {
            filter: { _id: order._id, status: ORDER_STATUS.PENDING },
            update: { $set: { status: ORDER_STATUS.EXPIRED } },
          },
        });

        // Prepare inventory recovery updates for events
        eventBulkOps.push({
          updateOne: {
            filter: { _id: order.event, "ticketTiers.name": order.tierName },
            update: {
              $inc: {
                "ticketTiers.$[tier].sold": -order.quantity,
                attendees: -order.quantity,
              },
            },
            arrayFilters: [{ "tier.name": order.tierName }],
          },
        });
      }

      // Execute Order updates atomically inside the transaction
      if (orderBulkOps.length > 0) {
        const orderResult = await Order.bulkWrite(orderBulkOps, { session });
        logger.info(
          `CRON: Bulk updated ${orderResult.modifiedCount} orders to EXPIRED.`,
        );
      }

      // Execute Event updates atomically inside the transaction
      if (eventBulkOps.length > 0) {
        await Event.bulkWrite(eventBulkOps, { session });
        logger.info(
          "CRON: Bulk released ticket tier capacities back to events.",
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

export const initVibeDecayCron = () => {
  // Runs every 10 minutes to cool down quiet venues
  cron.schedule("*/10 * * * *", async () => {
    logger.info("CRON: Checking for expired hotspot vibes to cool down...");

    try {
      const now = new Date();

      // 1. Target hotspots that are past their decay window and aren't already set to UNKNOWN/CHILL
      const expiredHotspots = await Hotspot.find({
        decayAt: { $lte: now },
        "vibeCheck.currentVibe": { $nin: ["UNKNOWN", "CHILL"] },
      });

      if (expiredHotspots.length === 0) {
        return;
      }

      logger.info(
        `CRON: Decaying real-time vibe for ${expiredHotspots.length} hotspots.`,
      );

      for (const hotspot of expiredHotspots) {
        // 2. Synchronize the summary object with MongoDB's background array cleanup
        hotspot.vibeCheck.currentVibe = "CHILL";
        hotspot.vibeCheck.totalVotes = 0;
        hotspot.vibeCheck.counts = { lit: 0, lively: 0, chill: 0, dull: 0 };
        hotspot.vibeCheck.lastUpdated = now;

        // Reset the decay window forward to prevent re-matching on the next run
        hotspot.decayAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

        // Save changes cleanly
        await hotspot.save();

        // 3. Serialize document to recalculate virtual metrics dynamically
        const hotspotData = hotspot.toObject({ virtuals: true });

        // 4. BROADCAST TO REAL-TIME CLIENTS
        getIO().to(`hotspot:${hotspot._id}`).emit("hotspot-vibe-updated", {
          hotspotId: hotspot._id,
          vibeCheck: hotspotData.vibeCheck,
          energyScore: hotspotData.energyScore,
          vibeScore: hotspotData.vibeScore,
          heatIntensity: hotspotData.heatIntensity,
          vibeFreshness: hotspotData.vibeFreshness,
          computedAuraRadius: hotspotData.computedAuraRadius,
        });

        logger.info(
          `CRON: Hotspot [${hotspot.title}] has cooled down. Broadcast dispatched.`,
        );
      }
    } catch (error: any) {
      logger.error(`CRON VIBE DECAY ERROR: ${error.message}`);
    }
  });
};
