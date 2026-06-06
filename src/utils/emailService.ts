import { Resend } from "resend";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// BRAND CONSTANTS: UPDATED
const SKAUTE_CORAL = "#FF6B35";
const SKAUTE_NAVY = "#0F172A";
const SKAUTE_CREAM = "#FFF8F0";

const LOGO_PUBLIC_URL =
  "https://res.cloudinary.com/dzhfiblg7/image/upload/f_auto,q_auto,w_800/v1778054500/kivo_events/inhouse/skaute.jpg";

/**
 * Centered Brand Header Component
 */
const emailHeaderHtml = `
  <div style="text-align: center; padding: 32px 0 20px 0; background-color: ${SKAUTE_NAVY};">
    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle;">
          <div style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; display: inline-block;">
            <img src="${LOGO_PUBLIC_URL}" alt="Skaute Icon" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
          </div>
        </td>
        <td style="vertical-align: middle; padding-left: 10px;">
          <span style="font-family: sans-serif; font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -1px; text-transform: uppercase; line-height: 56px; display: inline-block;">
            skaute
          </span>
        </td>
      </tr>
    </table>
  </div>
`;

export const sendWelcomeEmail = async (to: string, name: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to: to,
      subject: "⚡ Welcome to Skaute — The Movement Starts Here",
      html: `
        <div style="font-family: sans-serif; background-color: ${SKAUTE_CREAM}; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);">
            ${emailHeaderHtml}
            <div style="padding: 32px;">
              <h1 style="font-size: 24px; color: ${SKAUTE_NAVY}; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase;">
                WELCOME TO THE CLIQUE, ${name.toUpperCase()}.
              </h1>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0;">
                Your account is locked in. Skaute is built to get you out of the house and directly into the best curated social moves, club mixers, and rave events happening live across Port Harcourt.
              </p>
              <div style="text-align: center;">
                <a href="https://skaute.onrender.com/discover" style="background-color: ${SKAUTE_CORAL}; color: #ffffff; font-weight: bold; text-decoration: none; text-transform: uppercase; padding: 16px 32px; border-radius: 16px; display: inline-block;">
                  Discover Live Events
                </a>
              </div>
            </div>
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Welcome Failure: ${error.message}`);
    throw error;
  }
};

export const sendTicketEmail = async (
  to: string,
  tickets: any[],
  eventImage: string,
  isDelayedReconciliation = false,
) => {
  try {
    const ticketListHtml = tickets
      .map(
        (ticket) => `
      <div style="margin-bottom: 24px; border: 2px solid ${SKAUTE_NAVY}; border-radius: 20px; padding: 20px;">
        <h3 style="margin: 0; color: ${SKAUTE_NAVY};">${ticket.tierName}</h3>
        <p style="font-family: monospace; color: ${SKAUTE_CORAL};">${ticket.checkInCode}</p>
      </div>
    `,
      )
      .join("");

    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to: to,
      subject: "🎟️ You're In! Your Official Skaute Access Passes",
      html: `
        <div style="font-family: sans-serif; background-color: ${SKAUTE_CREAM}; padding: 40px 20px;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden;">
            ${emailHeaderHtml}
            <div style="padding: 32px;">
              <h1 style="color: ${SKAUTE_NAVY};">YOUR ADVENTURE AWAITS.</h1>
              ${ticketListHtml}
            </div>
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Ticket Failure: ${error.message}`);
    throw error;
  }
};

export const sendRefundEmail = async (to: string, ticket: any) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to: to,
      subject: "💸 Refund Confirmed - Skaute",
      html: `
        <div style="font-family: sans-serif; background-color: #F8FAFC; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; border: 1px solid #E2E8F0; padding: 0 0 40px 0; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
            
            ${emailHeaderHtml}
            
            <div style="padding: 0 32px;">
              <div style="background-color: rgba(239, 68, 68, 0.1); width: 64px; height: 64px; border-radius: 20px; margin: 24px auto; text-align: center;">
                <span style="font-size: 28px; line-height: 64px;">💸</span>
              </div>

              <h1 style="font-family: sans-serif; font-size: 24px; color: ${SKAUTE_NAVY}; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase;">
                REFUND DISPATCHED
              </h1>
              <p style="color: #64748B; font-size: 14px; margin: 0 0 32px 0;">
                Your pass for <strong>${ticket.tierName}</strong> has been cancelled.
              </p>

              <div style="margin: 0 0 32px 0; padding: 24px; background-color: ${SKAUTE_CREAM}; border-radius: 24px; border: 2px dashed ${SKAUTE_CORAL};">
                <p style="margin: 0; font-size: 10px; color: ${SKAUTE_NAVY}; font-weight: bold; text-transform: uppercase;">TOTAL REVERSED</p>
                <p style="margin: 6px 0 0 0; font-size: 32px; font-weight: 900; color: ${SKAUTE_CORAL};">₦${ticket.pricePaid.toLocaleString()}</p>
              </div>

              <div style="text-align: left; background-color: #F8FAFC; border-left: 4px solid ${SKAUTE_CORAL}; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 12px; color: ${SKAUTE_NAVY}; font-weight: 900; text-transform: uppercase;">Direct Bank Transfer Notice:</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #475569;">Your refund has been initiated via Paystack. Please allow 3-5 business days for bank processing.</p>
              </div>

              <p style="font-size: 11px; color: #94A3B8; text-transform: uppercase;">TICKET ID: ${ticket.ticketCode}</p>
            </div>
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Refund Service Failure: ${error.message}`);
    throw error;
  }
};

export const sendEventModerationEmail = async ({
  to,
  organizerName,
  eventTitle,
  status,
  reason,
}: any) => {
  const isApproved = status === "approved";
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to: to,
      subject: isApproved ? "🎉 Your Event Is Live" : "⚠️ Event Review Update",
      html: `
        <div style="font-family: sans-serif; background-color: ${SKAUTE_CREAM}; padding: 40px 20px;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; padding-bottom: 40px;">
            ${emailHeaderHtml}
            <div style="padding: 32px;">
              <h1 style="color: ${SKAUTE_NAVY}; text-transform: uppercase;">${isApproved ? "EVENT APPROVED" : "REVIEW UPDATE"}</h1>
              <p>Hello ${organizerName}, your event <strong>${eventTitle}</strong> is ${isApproved ? "live." : "pending changes."}</p>
              <div style="padding: 20px; background: ${isApproved ? "#F0FDF4" : "#FEF2F2"}; border-radius: 16px;">
                ${isApproved ? "Your move is now visible on the map!" : reason}
              </div>
            </div>
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Event Moderation Email Failure: ${error.message}`);
    throw error;
  }
};

export const sendCancellationEmail = async (
  to: string,
  buyerName: string,
  eventTitle: string,
) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to: to,
      subject: `⚠️ Update: ${eventTitle} Cancelled`,
      html: `
        <div style="font-family: sans-serif; background-color: ${SKAUTE_CREAM}; padding: 40px 20px;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden;">
            ${emailHeaderHtml}
            <div style="padding: 32px;">
              <h1 style="color: ${SKAUTE_NAVY};">HEY ${buyerName.toUpperCase()}, A MOVE WAS CANCELLED.</h1>
              <p style="color: #475569;">The organizer has cancelled <strong>${eventTitle}</strong>. Your ticket is now void and the refund process has begun automatically.</p>
              <a href="https://skaute.onrender.com/discover" style="background-color: ${SKAUTE_CORAL}; color: #ffffff; padding: 16px 32px; border-radius: 16px; text-decoration: none; display: inline-block;">Find Alternative Vibe</a>
            </div>
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Cancellation Service Failure: ${error.message}`);
    throw error;
  }
};
