import { EventEmitter } from "events";
import logger from "./logger.js";
import { sendTicketEmail } from "./emailService.js";
// import { sendTicketEmail } from '../services/emailService.js';

const kivoEvents = new EventEmitter();

// This "listener" waits for orders to be completed
kivoEvents.on("order.fulfilled", async ({ order, tickets, eventImage }) => {
  try {
    logger.info(`Background: Sending tickets for Order ${order._id}`);

    await sendTicketEmail(order.buyerEmail, tickets, eventImage);

    logger.info(`Background: Email sent successfully to ${order.buyerEmail}`);
  } catch (error: any) {
    logger.error(`Background Error: Failed to send email: ${error.message}`);
  }
});

export default kivoEvents;
