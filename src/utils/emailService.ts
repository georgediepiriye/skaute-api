import { Resend } from "resend";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// BRAND CONSTANTS FOR PREMIUM URBAN STYLING
const SKAUTE_BLUE = "#0052FF";
const SKAUTE_YELLOW = "#FFD700";
const MIDNIGHT_DARK = "#0B0E14";

const LOGO_PUBLIC_URL =
  "https://res.cloudinary.com/dzhfiblg7/image/upload/f_auto,q_auto,w_800/v1778054500/kivo_events/inhouse/skaute.jpg";

/**
 * Centered Brand Header Component containing the clean white logo isolation layout
 */
const emailHeaderHtml = `
  <div style="text-align: center; padding: 32px 0 20px 0; background-color: #161B26;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle;">
          <div style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); display: inline-block;">
            <img 
              src="${LOGO_PUBLIC_URL}" 
              alt="Skaute Icon" 
              style="width: 100%; height: 100%; object-fit: contain; display: block;" 
            />
          </div>
        </td>
        <td style="vertical-align: middle; padding-left: 10px;">
          <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -1px; text-transform: uppercase; line-height: 56px; display: inline-block;">
            skaute
          </span>
        </td>
      </tr>
    </table>
  </div>
`;

const targetRecipient = "georgediepiriye4u@gmail.com";

export const sendWelcomeEmail = async (to: string, name: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <onboarding@resend.dev>",
      to: targetRecipient,
      subject: "⚡ Welcome to Skaute — The Movement Starts Here",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            
            ${emailHeaderHtml}
            
            <div style="padding: 12px 32px 40px 32px;">
              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 26px; line-height: 1.1; color: #FFFFFF; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                WELCOME TO THE CLIQUE, ${name.toUpperCase()}.
              </h1>
              
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; font-weight: 500;">
                Your account is locked in and ready. Skaute is built to get you out of the house, onto the map, and directly into the best curated social moves, club mixers, concerts, and rave events happening live across town.
              </p>
              
              <div style="background-color: #0B0E14; border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; padding: 24px; margin-bottom: 32px; text-align: left;">
                <h3 style="margin: 0 0 14px 0; font-family: 'Arial Black', Impact, sans-serif; font-size: 11px; color: ${SKAUTE_BLUE}; letter-spacing: 1.5px; text-transform: uppercase;">
                  YOUR NEXT MOVES:
                </h3>
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                  <tr>
                    <td style="font-size: 20px; width: 30px; vertical-align: top;">📍</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #FFFFFF; font-weight: 700;">Explore the Live Map</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">Track real-time vibes and see events happening around you instantly.</p>
                    </td>
                  </tr>
                </table>

                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                  <tr>
                    <td style="font-size: 20px; width: 30px; vertical-align: top;">🎟️</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #FFFFFF; font-weight: 700;">Fast-Pass Check-In</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">Any ticket you buy lands instantly in your email with a direct gate-entry QR code.</p>
                    </td>
                  </tr>
                </table>

                <table width="100%" border="0" cellpadding="0" cellspacing="0;">
                  <tr>
                    <td style="font-size: 20px; width: 30px; vertical-align: top;">🔥</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #FFFFFF; font-weight: 700;">Host Your Own Movement</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">Planning a link-up, pop-up, or full party? Switch to host mode and publish it on the map.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-bottom: 12px;">
                <a href="https://skaute.onrender.com/discover" style="background-color: ${SKAUTE_BLUE}; color: #FFFFFF; font-family: 'Arial Black', Impact, sans-serif; font-size: 12px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; padding: 16px 32px; border-radius: 16px; display: inline-block; box-shadow: 0 10px 20px -5px rgba(0, 82, 255, 0.4);">
                  Discover Live Events
                </a>
              </div>

              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 40px; padding-top: 24px;">
                <p style="font-family: 'Arial Black', Impact, sans-serif; font-size: 13px; color: ${SKAUTE_YELLOW}; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 4px 0;">
                  SKAUTE
                </p>
                <p style="font-size: 10px; color: #56647A; font-weight: bold; text-transform: uppercase;">
                  Port Harcourt, Rivers State
                </p>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Welcome Service Failure: ${error.message}`);
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
    // Format shared event fields cleanly using data from the initial ticket instance if available
    const exampleTicket = tickets[0] || {};
    const eventTitle = exampleTicket.event?.title || "Skaute Premium Move";
    const venueAddress =
      exampleTicket.event?.location?.address || "Port Harcourt, Nigeria";

    const formattedDate = exampleTicket.event?.startDate
      ? new Date(exampleTicket.event.startDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "DATE TBD";

    const formattedTime = exampleTicket.event?.startDate
      ? new Date(exampleTicket.event.startDate).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TIME TBD";

    const ticketListHtml = tickets
      .map(
        (ticket) => `
        <div style="margin-bottom: 32px; background-color: #ffffff; border-radius: 28px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 20px 40px rgba(0,0,0,0.04); text-align: left;">
          
          <div style="background-color: #020617; border-bottom: 1px solid #0f172a; position: relative;">
            <div style="background-color: ${SKAUTE_BLUE}; height: 3px; font-size: 1px; line-height: 1px;">&nbsp;</div>
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding: 20px 24px;">
              <tr>
                <td width="56" style="vertical-align: middle;">
                  <img src="${LOGO_PUBLIC_URL}" width="52" height="52" style="display: block; object-contain: contain;" alt="Skaute" />
                </td>
                <td style="padding-left: 12px; vertical-align: middle;">
                  <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 9px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 2px;">PREMIUM ACCESS</p>
                  <h2 style="margin: 2px 0 0 0; font-family: 'Arial Black', Impact, sans-serif; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; italic: italic; letter-spacing: -0.5px; line-height: 1;">EVENT PASS</h2>
                  <p style="margin: 4px 0 0 0; font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">
                    <span style="color: ${SKAUTE_YELLOW}; font-size: 10px;">•</span> SKAUTE VERIFIED
                  </p>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <div style="border: 1px solid rgba(255, 215, 0, 0.3); background-color: rgba(255, 255, 255, 0.04); padding: 6px 14px; border-radius: 9999px; display: inline-block;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 900; color: ${SKAUTE_YELLOW}; text-transform: uppercase; letter-spacing: 1.5px;">VALID</span>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding: 24px 28px 16px 28px; background-color: #ffffff;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align: top;">
                  <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px;">EVENT</p>
                  <h3 style="margin: 6px 0 0 0; font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; font-weight: 900; color: #0F172A; text-transform: uppercase; line-height: 1.1;">
                    ${eventTitle}
                  </h3>
                </td>
                <td align="right" style="vertical-align: top; padding-left: 10px;">
                  <div style="background: linear-gradient(135deg, ${SKAUTE_BLUE}, #2563eb); background-color: ${SKAUTE_BLUE}; padding: 8px 16px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 10px rgba(0,52,255,0.15);">
                    <span style="font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; white-space: nowrap;">
                      ${ticket.tierName}
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
            <tr>
              <td width="12" style="background-color: #161B26; height: 24px; border-radius: 0 12px 12px 0; border: 1px solid #E2E8F0; border-left: none;">&nbsp;</td>
              <td style="border-bottom: 2px dashed #E2E8F0; font-size: 1px; line-height: 1px;">&nbsp;</td>
              <td width="12" style="background-color: #161B26; height: 24px; border-radius: 12px 0 0 12px; border: 1px solid #E2E8F0; border-right: none;">&nbsp;</td>
            </tr>
          </table>

          <div style="padding: 16px 28px 24px 28px; background-color: #ffffff;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="130" align="left" style="vertical-align: middle; padding-right: 20px;">
                  <div style="background-color: #ffffff; padding: 10px; border-radius: 20px; border: 1px solid #F1F5F9; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.03);">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${ticket.checkInCode}&margin=0" 
                      alt="Skaute Access QR" 
                      width="110" 
                      height="110" 
                      style="display: block; border-radius: 8px;" 
                    />
                  </div>
                </td>
                
                <td style="vertical-align: middle;">
                  <div style="margin-bottom: 12px;">
                    <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">ENTRY CODE</p>
                    <p style="margin: 2px 0 0 0; font-family: monospace; font-size: 13px; font-weight: bold; color: ${SKAUTE_BLUE}; letter-spacing: 0.5px; text-transform: uppercase;">
                      ${ticket.checkInCode}
                    </p>
                  </div>

                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                    <tr>
                      <td width="50%" style="vertical-align: top; padding-right: 4px;">
                        <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">DATE</p>
                        <p style="margin: 2px 0 0 0; font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 900; color: #334155; text-transform: uppercase;">${formattedDate}</p>
                      </td>
                      <td width="50%" style="vertical-align: top; padding-left: 4px;">
                        <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">TIME</p>
                        <p style="margin: 2px 0 0 0; font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 900; color: #334155; text-transform: uppercase;">${formattedTime}</p>
                      </td>
                    </tr>
                  </table>

                  <div>
                    <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">VENUE</p>
                    <p style="margin: 2px 0 0 0; font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 900; color: #334155; text-transform: uppercase; line-height: 1.2;">
                      ${venueAddress}
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #F8FAFC; border-top: 1px solid #F1F5F9; padding: 14px 28px; position: relative;">
            <div style="background-color: ${SKAUTE_BLUE}; height: 2px; font-size: 1px; line-height: 1px; position: absolute; top: 0; left: 0; width: 100%;">&nbsp;</div>
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">ADMIT ONE</p>
                  <p style="margin: 2px 0 0 0; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 900; color: #0F172A; text-transform: uppercase;">
                    ${ticket.buyerInfo?.firstName || "Guest"} ${ticket.buyerInfo?.lastName || "Attendee"}
                  </p>
                </td>
                <td align="right">
                  <p style="margin: 0; font-family: -apple-system, sans-serif; font-size: 8px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px;">TICKET ID</p>
                  <p style="margin: 2px 0 0 0; font-family: monospace; font-size: 11px; font-weight: bold; color: #64748B;">
                    #${ticket.ticketCode || "00000"}
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>
      `,
      )
      .join("");

    const emailSubject = isDelayedReconciliation
      ? "🎟️ Secured! Your Skaute Event Passes (Network delay resolved)"
      : "🎟️ You're In! Your Official Skaute Access Passes";

    const bannerHeadline = isDelayedReconciliation
      ? "YOUR TICKETS ARE SECURED."
      : "YOUR ADVENTURE AWAITS.";

    const messageBodyText = isDelayedReconciliation
      ? `We noticed your payment cleared successfully, but a brief upstream network hiccup delayed our instant ticket delivery. No worries at all—we have dynamically reclaimed your booking seats and secured your spot. Your official digital credentials are listed below.`
      : `Thanks for booking with Skaute. Your transactions went through safely, your credentials have been hard-locked into the entry Manifest, and your passes are fully validated below. See you at the move!`;

    const { data, error } = await resend.emails.send({
      from: "Skaute <onboarding@resend.dev>",
      to: targetRecipient,
      subject: emailSubject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            
            ${emailHeaderHtml}
            
            <div style="position: relative; width: 100%; height: 220px; overflow: hidden; background-color: #000;">
              <img src="${eventImage}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.85;" alt="Skaute Movement Image" />
            </div>
            
            <div style="padding: 32px 24px;">
              
              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 24px; line-height: 1.1; color: #FFFFFF; font-weight: 900; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                ${bannerHeadline}
              </h1>
              
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; font-weight: 500;">
                ${messageBodyText}
              </p>
              
              ${ticketListHtml}
              
              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 40px; padding-top: 24px;">
                <p style="font-family: 'Arial Black', Impact, sans-serif; font-size: 14px; color: ${SKAUTE_YELLOW}; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 6px 0;">
                  SKAUTE
                </p>
                <p style="font-size: 11px; color: #56647A; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                  Port Harcourt, Rivers State • Nigeria
                </p>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Ticket Service Failure: ${error.message}`);
    throw error;
  }
};

export const sendRefundEmail = async (to: string, ticket: any) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <onboarding@resend.dev>",
      to: targetRecipient,
      subject: "💸 Refund Confirmed - Skaute",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); padding: 0 0 40px 0; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            
            <!-- Dynamic Brand Header Component Insertion with Logo -->
            ${emailHeaderHtml}
            
            <div style="padding: 0 32px;">
              <!-- Success Status Pill Indicator Component -->
              <div style="background-color: rgba(239, 68, 68, 0.1); width: 64px; height: 64px; border-radius: 20px; margin: 24px auto; text-align: center;">
                <span style="font-size: 28px; line-height: 64px; color: #EF4444;">💸</span>
              </div>

              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 24px; color: #FFFFFF; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                REFUND DISPATCHED
              </h1>
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.5; margin: 0 0 32px 0; font-weight: 500;">
                Your pass for the <strong style="color: #FFF;">${ticket.tierName}</strong> tier has been cancelled successfully. Your booking slots have been cleared and released.
              </p>

              <!-- Premium Pricing Receipt Subcard Component Block -->
              <div style="margin: 0 0 32px 0; padding: 24px; background-color: #0B0E14; border-radius: 24px; border: 2px dashed rgba(255,255,255,0.08); text-align: center;">
                <p style="margin: 0; font-size: 10px; color: #56647A; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
                  TOTAL REVENUE REVERSED
                </p>
                <p style="margin: 6px 0 0 0; font-family: 'Arial Black', Impact, sans-serif; font-size: 32px; font-weight: 900; color: ${SKAUTE_YELLOW};">
                  ₦${ticket.pricePaid.toLocaleString()}
                </p>
              </div>

              <!-- Warning Callout Notification Block Box Component -->
              <div style="text-align: left; background-color: rgba(0, 82, 255, 0.05); border-left: 4px solid ${SKAUTE_BLUE}; border-radius: 4px 16px 16px 4px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #FFFFFF; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
                  Direct Bank Transfer Notice:
                </p>
                <p style="margin: 0; font-size: 13px; color: #94A3B8; line-height: 1.5; font-weight: 500;">
                  Skaute runs a strict wallet-less architectural profile. This capital payload has been wired directly back into your original funding source bank account or credit card structure via Paystack. Reversal settlement periods take between 3-5 standard working business days to complete depending on bank routing speed.
                </p>
              </div>

              <p style="font-family: monospace; font-size: 11px; color: #56647A; font-weight: bold; margin: 0 0 32px 0; text-transform: uppercase;">
                TICKET ID: ${ticket.ticketCode} • REFID: ${ticket.order?.paymentReference || "N/A"}
              </p>

              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px;">
                <p style="font-family: 'Arial Black', Impact, sans-serif; font-size: 13px; color: #FFFFFF; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 4px 0;">
                  SKAUTE
                </p>
                <p style="font-size: 10px; color: #56647A; font-weight: bold; text-transform: uppercase;">
                  PORT HARCOURT
                </p>
              </div>
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
}: {
  to: string;
  organizerName: string;
  eventTitle: string;
  status: "approved" | "rejected";
  reason?: string;
}) => {
  try {
    const isApproved = status === "approved";

    const { data, error } = await resend.emails.send({
      from: "Skaute <onboarding@resend.dev>",
      to: targetRecipient,

      subject: isApproved
        ? "🎉 Your Skaute Event Has Been Approved"
        : "⚠️ Your Skaute Event Needs Changes",

      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">

            ${emailHeaderHtml}

            <div style="padding: 20px 32px 40px 32px;">

              <div style="
                width:72px;
                height:72px;
                border-radius:24px;
                margin: 0 auto 24px auto;
                background:${isApproved ? "rgba(0,82,255,0.15)" : "rgba(239,68,68,0.12)"};
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:32px;
              ">
                ${isApproved ? "🎉" : "⚠️"}
              </div>

              <h1 style="
                font-family:'Arial Black', Impact, sans-serif;
                font-size:28px;
                color:#FFFFFF;
                text-transform:uppercase;
                line-height:1.1;
                margin:0 0 18px 0;
              ">
                ${isApproved ? "YOUR EVENT IS LIVE." : "EVENT REVIEW UPDATE."}
              </h1>

              <p style="
                color:#94A3B8;
                font-size:14px;
                line-height:1.7;
                margin-bottom:24px;
              ">
                Hello ${organizerName},
              </p>

              <div style="
                background:#0F172A;
                border:1px solid rgba(255,255,255,0.06);
                border-radius:24px;
                padding:24px;
                margin-bottom:24px;
              ">
                <p style="
                  margin:0 0 8px 0;
                  font-size:10px;
                  letter-spacing:2px;
                  text-transform:uppercase;
                  color:${SKAUTE_BLUE};
                  font-weight:900;
                ">
                  EVENT TITLE
                </p>

                <h2 style="
                  margin:0;
                  font-size:22px;
                  color:#FFFFFF;
                  font-weight:900;
                  line-height:1.2;
                ">
                  ${eventTitle}
                </h2>
              </div>

              ${
                isApproved
                  ? `
                    <div style="
                      background: rgba(0,82,255,0.08);
                      border-left:4px solid ${SKAUTE_BLUE};
                      padding:20px;
                      border-radius:4px 18px 18px 4px;
                    ">
                      <p style="
                        margin:0;
                        color:#CBD5E1;
                        line-height:1.7;
                        font-size:14px;
                      ">
                        Your move has passed moderation and is now visible across Skaute discovery surfaces.
                        Users can now discover, share, and purchase tickets for your event.
                      </p>
                    </div>
                  `
                  : `
                    <div style="
                      background: rgba(239,68,68,0.08);
                      border-left:4px solid #EF4444;
                      padding:20px;
                      border-radius:4px 18px 18px 4px;
                    ">
                      <p style="
                        margin:0 0 12px 0;
                        color:#FFFFFF;
                        font-size:12px;
                        font-weight:900;
                        text-transform:uppercase;
                        letter-spacing:1px;
                      ">
                        Rejection Reason
                      </p>

                      <p style="
                        margin:0;
                        color:#CBD5E1;
                        line-height:1.7;
                        font-size:14px;
                      ">
                        ${reason || "Your event requires additional adjustments before approval."}
                      </p>
                    </div>
                  `
              }

              <div style="text-align:center;margin-top:36px;">
                <a
                  href="https://skaute.onrender.com/dashboard/events"
                  style="
                    background:${SKAUTE_BLUE};
                    color:#FFFFFF;
                    text-decoration:none;
                    padding:16px 28px;
                    border-radius:16px;
                    display:inline-block;
                    font-size:11px;
                    font-weight:900;
                    text-transform:uppercase;
                    letter-spacing:2px;
                  "
                >
                  Open Dashboard
                </a>
              </div>

              <div style="
                text-align:center;
                border-top:1px solid rgba(255,255,255,0.06);
                margin-top:40px;
                padding-top:24px;
              ">
                <p style="
                  font-family:'Arial Black', Impact, sans-serif;
                  font-size:13px;
                  color:${SKAUTE_YELLOW};
                  letter-spacing:3px;
                  text-transform:uppercase;
                  margin:0;
                ">
                  SKAUTE
                </p>
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
      from: "Skaute <onboarding@resend.dev>", // Replace with your production domain verified sender
      to: targetRecipient, // Hardcoded to your test box based on your recipient config rules
      subject: `⚠️ Update: ${eventTitle.toUpperCase()} has been Cancelled`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,0,0,0.1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);">
            
            ${emailHeaderHtml}
            
            <div style="padding: 12px 32px 40px 32px;">
              
              <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 12px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 20px; vertical-align: middle;">⚠️</span>
                <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 11px; color: #EF4444; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 900; margin-left: 6px; vertical-align: middle;">
                  Important Event Status Update
                </span>
              </div>

              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; line-height: 1.2; color: #FFFFFF; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                HEY ${buyerName.toUpperCase()}, A MOVE WAS CANCELLED.
              </h1>
              
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                The organizer has officially cancelled <span style="color: #FFFFFF; font-weight: 700;">${eventTitle}</span>. Because of this, your digital ticket credentials and access codes for this move have been frozen and pulled out of the entry validation manifests.
              </p>
              
              <div style="background-color: #0B0E14; border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; padding: 24px; margin-bottom: 32px; text-align: left;">
                <h3 style="margin: 0 0 14px 0; font-family: 'Arial Black', Impact, sans-serif; font-size: 11px; color: ${SKAUTE_BLUE}; letter-spacing: 1.5px; text-transform: uppercase;">
                  WHAT HAPPENS NEXT:
                </h3>
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                  <tr>
                    <td style="font-size: 20px; width: 30px; vertical-align: top;">💳</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #FFFFFF; font-weight: 700;">Automatic Financial Processing</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">Our accounting system has initiated the reversal process. Refunds are processed securely directly back to your original source accounts.</p>
                    </td>
                  </tr>
                </table>

                <table width="100%" border="0" cellpadding="0" cellspacing="0;">
                  <tr>
                    <td style="font-size: 20px; width: 30px; vertical-align: top;">🗺️</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #FFFFFF; font-weight: 700;">Find a Alternative Vibe</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748B;">Don't sit inside. Pop open the live discovery map right now to find alternative clubs, link-ups, and active spaces across town.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-bottom: 12px;">
                <a href="https://skaute.onrender.com/discover" style="background-color: #1E293B; color: #FFFFFF; font-family: 'Arial Black', Impact, sans-serif; font-size: 11px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; padding: 16px 32px; border-radius: 16px; display: inline-block; border: 1px solid rgba(255,255,255,0.1);">
                  Return to Live Map
                </a>
              </div>

              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 40px; padding-top: 24px;">
                <p style="font-family: 'Arial Black', Impact, sans-serif; font-size: 13px; color: ${SKAUTE_YELLOW}; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 4px 0;">
                  SKAUTE
                </p>
                <p style="font-size: 10px; color: #56647A; font-weight: bold; text-transform: uppercase;">
                  Port Harcourt, Rivers State
                </p>
              </div>
              
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
