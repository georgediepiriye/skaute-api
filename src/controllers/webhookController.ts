import { Request, Response } from "express";
import httpStatus from "http-status";
import crypto from "crypto";
import * as ticketService from "./services/ticketService.js";
import config from "../config/config.js";
import { Transaction } from "../models/Transaction.js";
import { Order } from "../models/Order.js";
import mongoose from "mongoose";

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Handle body parsing safely regardless of middleware configuration
    let rawBody: string;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      // Fallback if global middleware has already converted it to an object
      rawBody = JSON.stringify(req.body);
    }

    // 2. Verify the signature using the resolved raw payload string
    const hash = crypto
      .createHmac("sha512", config.payments.paystackSecret!)
      .update(rawBody)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.warn("⚠️ Webhook Warning: Invalid signature received.");
      return res.status(400).send("Invalid signature");
    }

    // 3. Safely parse the verified string into a JSON object
    const event = JSON.parse(rawBody);

    // 4. Acknowledge receipt to Paystack IMMEDIATELY to prevent retries
    res.status(httpStatus.OK).send("Webhook Received");

    // 5. Process the fulfillment details asynchronously
    if (event.event === "charge.success") {
      const { reference, amount, metadata } = event.data;
      console.log("🚀 Webhook received & verified for reference:", reference);

      try {
        // Fetch order to guarantee data integrity across your collections
        const existingOrder = await Order.findOne({
          paymentReference: reference,
        });

        // Handle guest checking out anonymously context
        let finalUserId = null;
        if (metadata?.userId) {
          finalUserId = metadata.userId;
        } else if (existingOrder?.user) {
          finalUserId = existingOrder.user.toString();
        }

        // Event Context Fallback
        const finalEventId = metadata?.eventId || existingOrder?.event;

        if (!finalEventId) {
          console.error(
            `❌ Transaction missing critical Event mapping boundary context for ref: ${reference}`,
          );
          return;
        }

        // Convert amount from Kobo to Naira (Paystack sends 500000 for ₦5,000)
        const grossAmount = amount / 100;

        // Calculate your Platform Split Fee (10% commission rake)
        const platformFee = grossAmount * 0.1;
        const netAmount = grossAmount - platformFee;

        // D. Record the immutable record of financial truth
        await Transaction.create({
          user: finalUserId || undefined, // Binds undefined if guest checkout to align with unrequired Schema option
          event: new mongoose.Types.ObjectId(finalEventId.toString()),
          type: "ticket_sale",
          amount: grossAmount,
          fee: platformFee,
          netAmount: netAmount,
          status: "success",
          reference: reference,
          metadata: {
            channel: event.data.channel,
            gateway_response: event.data.gateway_response,
            ip_address: event.data.ip_address,
            paid_at: event.data.paid_at,
            tierName: metadata?.tierName || existingOrder?.tierName,
            quantity: metadata?.quantity || existingOrder?.quantity,
            buyerEmail: event.data.customer?.email || existingOrder?.buyerEmail,
            isGuestCheckout: !finalUserId,
          },
        });

        console.log(
          `💵 Transaction ledger logged successfully for ref: ${reference} (User: ${finalUserId || "GUEST"})`,
        );

        // E. 💡 FIXED: Call your unpacked function directly instead of using undefined ticketService object
        await ticketService.fulfillOrder(reference, metadata || {});
      } catch (fulfillError) {
        console.error(
          `❌ Critical error processing ledger or fulfilling order ${reference}:`,
          fulfillError,
        );
      }
    }
  } catch (error) {
    console.error("❌ Webhook Outer Lifecycle Error:", error);
    if (!res.headersSent) {
      res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .send("Webhook processing failed");
    }
  }
};
