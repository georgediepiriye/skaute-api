import { EventEmitter } from "events";
import logger from "./logger.js";
import {
  sendTicketEmail,
  sendRefundEmail,
  sendWelcomeEmail,
  sendEventModerationEmail,
  sendCancellationEmail,
  sendBroadcastEmail,
} from "./emailService.js"; // Assume sendRefundEmail exists

// Initialize the EventEmitter
const skauteEvents = new EventEmitter();

/**
 * Handle Welcome Email for New User Registration
 */
const handleUserSignup = async ({ user }: { user: any }) => {
  try {
    logger.info(`Background: Processing welcome template for user ${user._id}`);
    await sendWelcomeEmail(
      user.email,
      user.name || user.firstName || "Skauter",
    );
    logger.info(
      `Background: Welcome communication delivered successfully to ${user.email}`,
    );
  } catch (error: any) {
    logger.error(
      `Background Error: Failed to drop welcome sequence: ${error.message}`,
    );
  }
};

/**
 * Handle Order Fulfillment (Success)
 */

const handleOrderFulfilled = async ({
  order,
  tickets,
  eventImage,
  isManualPlacement = false,
  isDelayedReconciliation = false,
  event,
}: {
  order: any;
  tickets: any[];
  eventImage: string;
  isManualPlacement?: boolean;
  isDelayedReconciliation?: boolean;
  event?: any;
}) => {
  try {
    if (isManualPlacement) {
      logger.info(
        `Background: Processing Manual Complimentary Pass distribution for Event ${order.event} to ${order.buyerEmail}`,
      );
    } else {
      logger.info(
        `Background: Sending tickets for Standard Purchase Order ${order._id}`,
      );
    }

    await sendTicketEmail(
      order.buyerEmail,
      tickets,
      eventImage,
      isDelayedReconciliation,
      {
        event,
        order,
        isManualPlacement,
      },
    );

    logger.info(
      `Background: Ticket delivery email sent successfully to ${order.buyerEmail}`,
    );
  } catch (error: any) {
    logger.error(
      `Background Error: Failed to execute ticket delivery: ${error.message}`,
    );
  }
};

/**
 * Handle Ticket Refund (Cancellation)
 */
const handleTicketRefunded = async ({
  ticket,
  order,
}: {
  ticket: any;
  order: any;
}) => {
  try {
    logger.info(
      `Background: Processing refund notification for Ticket ${ticket.ticketCode}`,
    );

    // Call your email service to inform the user about the refund
    // In a no-wallet setup, it's vital to mention the 3-5 day bank processing time
    await sendRefundEmail(order.buyerEmail, ticket);

    logger.info(`Background: Refund notification sent to ${order.buyerEmail}`);
  } catch (error: any) {
    logger.error(
      `Background Error: Failed to send refund email: ${error.message}`,
    );
  }
};

const handleEventModerated = async ({
  organizer,
  event,
  status,
  reason,
}: {
  organizer: any;
  event: any;
  status: "approved" | "rejected";
  reason?: string;
}) => {
  try {
    logger.info(`Background: Sending moderation email for Event ${event._id}`);

    await sendEventModerationEmail({
      to: organizer.email,
      organizerName: organizer.name || "Skauter",
      eventTitle: event.title,
      status,
      reason,
    });

    logger.info(`Background: Moderation email sent to ${organizer.email}`);
  } catch (error: any) {
    logger.error(`Background Error: Moderation email failed: ${error.message}`);
  }
};

/**
 * Handle Broadcasted Event Cancellation to Ticket Holders
 */
const handleEventCancelled = async ({
  event,
  tickets,
}: {
  event: any;
  tickets: any[];
}) => {
  try {
    logger.info(
      `Background: Dispatching cancellation alerts for Event ${event._id} to ${tickets.length} ticket holders.`,
    );

    // Iterate through ticket holder manifest and fire async email pipelines
    const deliveryPromises = tickets.map((ticket) => {
      const buyerEmail = ticket.buyerInfo?.email || ticket.user?.email;
      const buyerName = ticket.buyerInfo?.firstName || "Skauter";

      if (buyerEmail) {
        return sendCancellationEmail(buyerEmail, buyerName, event.title);
      }
      return Promise.resolve();
    });

    await Promise.all(deliveryPromises);
    logger.info(
      `Background: Completed all cancellation mail drops for Event ${event._id}`,
    );
  } catch (error: any) {
    logger.error(
      `Background Error: Failed to drop cancellation alert batch: ${error.message}`,
    );
  }
};

/**
 * Handle Ticket Resend Request
 */
const handleTicketResent = async ({
  ticket,
  order,
}: {
  ticket: any;
  order: any;
}) => {
  try {
    logger.info(
      `Background: Re-dispatching ticket ${ticket.ticketCode} to ${order.buyerEmail}`,
    );

    await sendTicketEmail(
      order.buyerEmail,
      [ticket],
      ticket.event?.image,
      false,
      {
        event: ticket.event,
        order,
      },
    );

    logger.info(`Background: Ticket resend delivered to ${order.buyerEmail}`);
  } catch (error: any) {
    logger.error(
      `Background Error: Failed to execute ticket resend: ${error.message}`,
    );
  }
};

/**
 * Handle Event Broadcast (Email Blast)
 */
const handleEventBroadcast = async ({
  event,
  broadcast,
  recipients,
}: {
  event: any;
  broadcast: any;
  recipients: any[];
}) => {
  try {
    logger.info(
      `Background: Dispatching broadcast '${broadcast.subject}' to ${recipients.length} recipients.`,
    );

    // Map recipients to email promises
    const emailPromises = recipients.map((ticket) => {
      // Assuming your ticket object has the buyer email
      const email = ticket.buyerInfo?.email;
      if (email) {
        return sendBroadcastEmail(email, broadcast.subject, broadcast.message);
      }
      return Promise.resolve();
    });

    await Promise.all(emailPromises);

    logger.info(
      `Background: Successfully dispatched broadcast ${broadcast._id}`,
    );
  } catch (error: any) {
    logger.error(
      `Background Error: Broadcast delivery failed: ${error.message}`,
    );
    throw error; // This will trigger the catch block in your controller
  }
};

/**
 * PREVENT MEMORY LEAKS
 * removeAllListeners ensures we don't duplicate listeners during hot-reloads
 */
skauteEvents.removeAllListeners("order.fulfilled");
skauteEvents.removeAllListeners("ticket.refunded");
skauteEvents.removeAllListeners("user.signup");
skauteEvents.removeAllListeners("event.moderated");
skauteEvents.removeAllListeners("event.cancelled");
skauteEvents.removeAllListeners("ticket.resend");
skauteEvents.removeAllListeners("event.broadcast.created");

// Register the listeners
skauteEvents.on("order.fulfilled", handleOrderFulfilled);
skauteEvents.on("ticket.refunded", handleTicketRefunded);
skauteEvents.on("user.signup", handleUserSignup);
skauteEvents.on("event.moderated", handleEventModerated);
skauteEvents.on("event.cancelled", handleEventCancelled);
skauteEvents.on("ticket.resend", handleTicketResent);
skauteEvents.on("event.broadcast.created", handleEventBroadcast);
skauteEvents.setMaxListeners(20);

export default skauteEvents;
