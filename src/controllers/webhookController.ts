import { Request, Response } from "express";
import httpStatus from "http-status";
import crypto from "crypto";
import * as ticketService from "./services/ticketService.js";
import config from "../config/config.js";

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Convert the raw binary buffer explicitly to an exact UTF-8 string string
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
      const { reference, metadata } = event.data;
      console.log("🚀 Webhook received & verified for reference:", reference);

      // We wrap the fulfillment call in a nested try/catch block
      // so a database error won't crash the webhook execution flow or change the response status
      try {
        await ticketService.fulfillOrder(reference, metadata);
      } catch (fulfillError) {
        console.error(
          `❌ Critical error fulfilling order ${reference}:`,
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
