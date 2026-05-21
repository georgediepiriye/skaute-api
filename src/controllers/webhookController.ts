import { Request, Response } from "express";
import httpStatus from "http-status";
import crypto from "crypto";
import * as ticketService from "./services/ticketService.js";
import config from "../config/config.js";
import { Transaction } from "../models/Transaction.js";
import { Order } from "../models/Order.js";

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Convert the raw binary buffer explicitly to an exact UTF-8 string
    const rawBody = req.body.toString("utf8");

    // 2. Verify the signature using the raw string
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

    // 4. Acknowledge receipt to Paystack IMMEDIATELY
    // This prevents Paystack from timing out or retrying while your database processes the order
    res.status(httpStatus.OK).send("Webhook Received");

    // 5. Process the fulfillment details asynchronously
    if (event.event === "charge.success") {
      const { reference, amount, metadata } = event.data;
      console.log("🚀 Webhook received & verified for reference:", reference);

      // We wrap the fulfillment and transaction logging call in a nested try/catch block
      // so a database error won't crash the webhook execution flow or change the response status
      try {
        // Fetch order to guarantee data integrity across your collections
        const existingOrder = await Order.findOne({
          paymentReference: reference,
        });

        // Handle guest checking out anonymously context
        // If metadata.userId is an empty string, undefined, or missing, fall back to existingOrder
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

        // B. Convert amount from Kobo to Naira (Paystack sends 500000 for ₦5,000)
        const grossAmount = amount / 100;

        // C. Calculate your Platform Split Fee (e.g., 10% commission rake)
        const platformFee = grossAmount * 0.1;
        const netAmount = grossAmount - platformFee;

        // D. Record the immutable record of financial truth
        await Transaction.create({
          user: finalUserId, // Safely saves as a string ID, or explicitly as null if guest checkout
          event: finalEventId.toString(),
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

        // E. Complete structural ticket provisioning using standard fulfillment service flow
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
    // If we haven't sent a response yet (e.g., JSON parsing failed), send a 500 error
    if (!res.headersSent) {
      res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .send("Webhook processing failed");
    }
  }
};
