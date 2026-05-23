import { Resend } from "resend";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// BRAND CONSTANTS FOR PREMIUM URBAN STYLING
const SKAUTE_BLUE = "#0052FF";
const SKAUTE_YELLOW = "#FFD700";
const MIDNIGHT_DARK = "#0B0E14";

// PRODUCTION LOGO URL: Replace this string with your live hosted domain URL
// (e.g., "https://skaute.com/images/skaute_logo.jpg") once deployed to production.
const LOGO_PUBLIC_URL =
  "https://res.cloudinary.com/dzhfiblg7/image/upload/f_auto,q_auto,w_800/v1778054500/kivo_events/inhouse/skaute_logo.jpg";

/**
 * Centered Brand Header Component containing the clean white logo isolation layout
 */
const emailHeaderHtml = `
  <div style="text-align: center; padding: 32px 0 20px 0; background-color: #161B26;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td style="vertical-align: middle;">
          <!-- Circular Isolation Box for the white background logo -->
          <div style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); display: inline-block;">
            <img 
              src="${LOGO_PUBLIC_URL}" 
              alt="Skaute Icon" 
              style="width: 100%; height: 100%; object-fit: contain; display: block;" 
            />
          </div>
        </td>
        <td style="vertical-align: middle; padding-left: 10px;">
          <!-- Typographic Brand Title Text matching client header styles -->
          <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -1px; text-transform: uppercase; line-height: 56px; display: inline-block;">
            skaute
          </span>
        </td>
      </tr>
    </table>
  </div>
`;

// const targetRecipient =
//   config.env === "production" ? to : "georgediepiriye4u@gmail.com";

const targetRecipient = "georgediepiriye4u@gmail.com";

export const sendWelcomeEmail = async (to: string, name: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <onboarding@resend.dev>", // Replace with your verified sender in production
      to: targetRecipient,
      subject: "⚡ Welcome to Skaute — The Movement Starts Here",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #161B26; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            
            <!-- Brand Header Component -->
            ${emailHeaderHtml}
            
            <!-- Email Body Content Block Container -->
            <div style="padding: 12px 32px 40px 32px;">
              
              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 26px; line-height: 1.1; color: #FFFFFF; font-weight: 900; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                WELCOME TO THE CLIQUE, ${name.toUpperCase()}.
              </h1>
              
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; font-weight: 500;">
                Your account is locked in and ready. Skaute is built to get you out of the house, onto the map, and directly into the best curated social moves, club mixers, concerts, and rave events happening live across town.
              </p>
              
              <!-- Quick Navigation Card Elements -->
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

                <table width="100%" border="0" cellpadding="0" cellspacing="0; margin-bottom: 16px;">
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

              <!-- Call to Action Button Component -->
              <div style="text-align: center; margin-bottom: 12px;">
                <a href="https://skaute.onrender.com/discover" style="background-color: ${SKAUTE_BLUE}; color: #FFFFFF; font-family: 'Arial Black', Impact, sans-serif; font-size: 12px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; padding: 16px 32px; border-radius: 16px; display: inline-block; box-shadow: 0 10px 20px -5px rgba(0, 82, 255, 0.4);">
                  Discover Live Events
                </a>
              </div>

              <!-- Footer Component -->
              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 40px; padding-top: 24px;">
                <p style="font-family: 'Arial Black', Impact, sans-serif; font-size: 13px; color: ${SKAUTE_YELLOW}; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 4px 0;">
                  SKAUTE
                </p>
                <p style="font-size: 10px; color: #56647A; font-weight: bold; text-transform: uppercase; tracking-widest;">
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
    const ticketListHtml = tickets
      .map(
        (ticket) => `
        <div style="background-color: #ffffff; border: 2px solid #F1F5F9; border-radius: 24px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; position: relative; overflow: hidden;">
          <!-- Top Tag Accent -->
          <div style="background-color: ${SKAUTE_BLUE}; height: 6px; width: 100%; position: absolute; top: 0; left: 0;"></div>
          
          <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: ${SKAUTE_BLUE}; background-color: rgba(0, 82, 255, 0.08); padding: 6px 12px; border-radius: 9999px; display: inline-block; margin-bottom: 12px;">
            ${ticket.tierName} ACCESS PASS
          </span>
          
          <p style="margin: 0 0 16px 0; color: #64748B; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            HOLDER: <span style="color: #0F172A; font-weight: 900;">${ticket.buyerInfo.firstName} ${ticket.buyerInfo.lastName}</span>
          </p>
          
          <!-- Ticket Core Body Layout -->
          <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 16px; padding: 20px; display: inline-block; width: 85%;">
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${ticket.checkInCode}" 
              alt="Skaute Access QR" 
              style="width: 160px; height: 160px; display: block; margin: 0 auto; border-radius: 8px;" 
            />
            <div style="font-family: monospace; font-size: 15px; font-weight: bold; letter-spacing: 3px; color: #0F172A; margin-top: 14px; background: #ffffff; padding: 6px 12px; border-radius: 6px; display: inline-block; border: 1px solid #E2E8F0;">
              ${ticket.checkInCode}
            </div>
          </div>
          
          <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
            DO NOT DUPLICATE • SCAN AT ENTRY
          </p>
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
            
            <!-- Dynamic Brand Header Component Insertion with Logo -->
            ${emailHeaderHtml}
            
            <!-- Dynamic Main Image Aspect Header -->
            <div style="position: relative; width: 100%; height: 240px; overflow: hidden; background-color: #000;">
              <img src="${eventImage}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.85;" alt="Skaute Movement Image" />
            </div>
            
            <!-- Email Body Content Block Container -->
            <div style="padding: 32px 24px;">
              
              <!-- Title Block Element -->
              <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 24px; line-height: 1.1; color: #FFFFFF; font-weight: 900; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: -0.5px;">
                ${bannerHeadline}
              </h1>
              
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; font-weight: 500;">
                ${messageBodyText}
              </p>
              
              <!-- Ticket Render Target Payload Output -->
              ${ticketListHtml}
              
              <!-- Premium Branded Footer Signature Component -->
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
