import { Resend } from "resend";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const resend = new Resend(config.resendApiKey);

export const sendTicketEmail = async (
  to: string,
  tickets: any[],
  eventImage: string,
) => {
  try {
    const ticketListHtml = tickets
      .map(
        (ticket) => `
        <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 20px; background-color: #ffffff; text-align: center;">
          <h2 style="margin: 0; color: #1a1a1a; font-size: 18px; text-transform: uppercase;">${ticket.tierName}</h2>
          <p style="color: #666; margin: 5px 0;">Holder: <strong>${ticket.buyerInfo.firstName} ${ticket.buyerInfo.lastName}</strong></p>
          
          <div style="margin: 20px 0; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.checkInCode}" 
              alt="QR Code" 
              style="width: 150px; height: 150px;" 
            />
            <p style="font-family: monospace; font-size: 16px; letter-spacing: 2px; margin-top: 10px; color: #000; font-weight: bold;">
              ${ticket.checkInCode}
            </p>
          </div>
        </div>
      `,
      )
      .join("");

    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "georgediepiriye4u@gmail.com", //change to "to" in production
      subject: "🎟️ Your Scaute Event Tickets!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ddd;">
            
            <img src="${eventImage}" style="width: 100%; height: 200px; object-fit: cover;" alt="Event Banner" />
            
            <div style="padding: 20px;">
              <h1 style="font-size: 24px; color: #111; margin-top: 0;">Your Adventure Awaits!</h1>
              <p style="color: #555;">Thanks for booking with scaute. Please have your QR codes ready at the entrance.</p>
              
              ${ticketListHtml}
              
              <div style="text-align: center; border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px;">
                <p style="font-size: 12px; color: #999;">Scaute Platform • Port Harcourt, Rivers State</p>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Error: ${error.message}`);
    throw error;
  }
};

/**
 * Sends a refund confirmation email.
 * Reassures the user that money is returning to their original payment method.
 */
export const sendRefundEmail = async (to: string, ticket: any) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "georgediepiriye4u@gmail.com", // Change to "to" in production
      subject: "💸 Refund Confirmation - Scaute",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #fdfdfd; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eee; padding: 30px; text-align: center;">
            
            <div style="background-color: #f0fdf4; width: 60px; height: 60px; border-radius: 30px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <span style="font-size: 30px;">✅</span>
            </div>

            <h1 style="font-size: 22px; color: #111; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: -0.5px;">Refund Processed</h1>
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              Your ticket for <strong>${ticket.tierName}</strong> has been successfully cancelled and a refund has been initiated.
            </p>

            <div style="margin: 25px 0; padding: 20px; background-color: #f9f9f9; border-radius: 12px; border: 1px dashed #ddd;">
              <p style="margin: 0; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Amount Refunded</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #000;">₦${ticket.pricePaid.toLocaleString()}</p>
            </div>

            <div style="text-align: left; background-color: #fff4e5; border-left: 4px solid #ff9800; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 12px; color: #856404; font-weight: bold;">Important Note:</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #856404; line-height: 1.4;">
                Since we do not use an app wallet, the funds are sent directly to your <strong>original payment method</strong> (Bank/Card). This usually reflects in 3-5 business days depending on your bank.
              </p>
            </div>

            <p style="font-size: 11px; color: #aaa;">
              Ticket ID: ${ticket.ticketCode} • Reference: ${ticket.order?.paymentReference || "N/A"}
            </p>

            <div style="text-align: center; border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="font-size: 10px; color: #ccc; text-transform: uppercase; letter-spacing: 2px;">scaute • Port Harcourt</p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Refund Error: ${error.message}`);
    throw error;
  }
};
