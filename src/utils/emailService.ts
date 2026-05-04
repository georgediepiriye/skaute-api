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
              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.ticketCode}" 
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
      subject: "🎟️ Your Kivo Event Tickets!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ddd;">
            
            <img src="${eventImage}" style="width: 100%; height: 200px; object-fit: cover;" alt="Event Banner" />
            
            <div style="padding: 20px;">
              <h1 style="font-size: 24px; color: #111; margin-top: 0;">Your Adventure Awaits!</h1>
              <p style="color: #555;">Thanks for booking with Kivo. Please have your QR codes ready at the entrance.</p>
              
              ${ticketListHtml}
              
              <div style="text-align: center; border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px;">
                <p style="font-size: 12px; color: #999;">Kivo Platform • Port Harcourt, Rivers State</p>
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
