import { EventEmitter } from "events";
import logger from "./logger.js";
import { sendTicketEmail } from "./emailService.js";

// Initialize the EventEmitter
const kivoEvents = new EventEmitter();

/**
 * NAMED LISTENER FUNCTION
 * Using a named function allows us to manage it more effectively
 * than an anonymous arrow function.
 */
const handleOrderFulfilled = async ({
  order,
  tickets,
  eventImage,
}: {
  order: any;
  tickets: any;
  eventImage: string;
}) => {
  try {
    logger.info(`Background: Sending tickets for Order ${order._id}`);

    await sendTicketEmail(order.buyerEmail, tickets, eventImage);

    logger.info(`Background: Email sent successfully to ${order.buyerEmail}`);
  } catch (error: any) {
    logger.error(`Background Error: Failed to send email: ${error.message}`);
  }
};

/**
 * PREVENT MEMORY LEAKS
 * During hot-reloading (Nodemon), listeners can pile up.
 * removeAllListeners ensures we only ever have ONE active listener
 * for the 'order.fulfilled' event.
 */
kivoEvents.removeAllListeners("order.fulfilled");

// Register the listener
kivoEvents.on("order.fulfilled", handleOrderFulfilled);

// Optional: Increase the limit only if you plan to add 20+ DIFFERENT types of listeners
kivoEvents.setMaxListeners(20);

export default kivoEvents;
