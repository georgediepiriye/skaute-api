import { Resend } from "resend";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const resend = new Resend(config.resendApiKey);

const MIDNIGHT_NAVY = "#0F172A";
const CORAL_ORANGE = "#FF6B35";
const CREAM = "#FFF8F0";
const SLATE = "#475569";
const WHITE = "#FFFFFF";
const BORDER = "#E2E8F0";
const MUTED = "#94A3B8";

const DISCOVER_URL = "https://skaute.com/discover";
const LOGO_PUBLIC_URL =
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1781035822/skaute_events/logo_main_lvj0fr.webp";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (value: unknown) => {
  const amount = Number(value) || 0;
  return `₦${amount.toLocaleString("en-NG")}`;
};

const buttonHtml = (label: string, href: string) => `
  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0 0 0;">
    <tr>
      <td>
        <a href="${href}" style="background-color: ${CORAL_ORANGE}; border-radius: 12px; color: ${WHITE}; display: inline-block; font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; line-height: 1; padding: 15px 22px; text-decoration: none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>
`;

const emailHeaderHtml = `
  <div style="background-color: ${MIDNIGHT_NAVY}; padding: 30px 28px;">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
      <tr>
        <td style="vertical-align: middle;">
          <table border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align: middle;">
                <div style="background-color: ${WHITE}; border-radius: 14px; height: 48px; overflow: hidden; width: 48px;">
                  <img src="${LOGO_PUBLIC_URL}" alt="Skaute" style="border: 0; display: block; height: 48px; object-fit: cover; width: 48px;" />
                </div>
              </td>
              <td style="padding-left: 12px; vertical-align: middle;">
                <div style="color: ${WHITE}; font-family: Arial, sans-serif; font-size: 24px; font-weight: 900; letter-spacing: 0; line-height: 1;">
                  Skaute
                </div>
                <div style="color: ${CREAM}; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin-top: 5px;">
                  Discover trusted social experiences.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

const emailShell = (content: string) => `
  <!doctype html>
  <html>
    <body style="background-color: ${CREAM}; margin: 0; padding: 0;">
      <div style="background-color: ${CREAM}; font-family: Arial, sans-serif; padding: 36px 18px;">
        <div style="background-color: ${WHITE}; border: 1px solid ${BORDER}; border-radius: 18px; margin: 0 auto; max-width: 600px; overflow: hidden;">
          ${emailHeaderHtml}
          <div style="padding: 34px 30px;">
            ${content}
          </div>
          <div style="border-top: 1px solid ${BORDER}; color: ${MUTED}; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; padding: 22px 30px;">
            This email was sent by Skaute. If you need help, reply to this message and our team will assist.
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const eyebrowHtml = (label: string) => `
  <p style="color: ${CORAL_ORANGE}; font-family: Arial, sans-serif; font-size: 12px; font-weight: 900; letter-spacing: 0; line-height: 1.4; margin: 0 0 10px 0; text-transform: uppercase;">
    ${escapeHtml(label)}
  </p>
`;

const headingHtml = (text: string) => `
  <h1 style="color: ${MIDNIGHT_NAVY}; font-family: Arial, sans-serif; font-size: 28px; font-weight: 900; letter-spacing: 0; line-height: 1.2; margin: 0 0 16px 0;">
    ${escapeHtml(text)}
  </h1>
`;

const paragraphHtml = (text: string) => `
  <p style="color: ${SLATE}; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.7; margin: 0 0 18px 0;">
    ${escapeHtml(text)}
  </p>
`;

export const sendWelcomeEmail = async (to: string, name: string) => {
  const firstName = name || "there";

  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: "Welcome to Skaute",
      html: emailShell(`
        ${eyebrowHtml("Account created")}
        ${headingHtml(`Welcome to Skaute, ${firstName}.`)}
        ${paragraphHtml(
          "Your account is ready. Skaute helps you discover credible events, hotspots, and social experiences worth showing up for.",
        )}
        ${paragraphHtml(
          "Start with the discovery feed to find what is live, nearby, and relevant to your kind of outing.",
        )}
        ${buttonHtml("Explore Skaute", DISCOVER_URL)}
      `),
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
      .map((ticket) => {
        const tierName = escapeHtml(ticket.tierName || "Access Pass");
        const checkInCode = escapeHtml(
          ticket.checkInCode || ticket.ticketCode || "Pending",
        );
        const ticketCode = escapeHtml(ticket.ticketCode);

        return `
          <div style="border: 1px solid ${BORDER}; border-radius: 14px; margin: 0 0 14px 0; padding: 18px;">
            <p style="color: ${MIDNIGHT_NAVY}; font-family: Arial, sans-serif; font-size: 16px; font-weight: 900; line-height: 1.4; margin: 0 0 8px 0;">
              ${tierName}
            </p>
            <p style="color: ${SLATE}; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; margin: 0 0 10px 0;">
              Present this code at check-in.
            </p>
            <div style="background-color: ${CREAM}; border-left: 4px solid ${CORAL_ORANGE}; border-radius: 10px; color: ${MIDNIGHT_NAVY}; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 800; letter-spacing: 0; padding: 14px;">
              ${checkInCode}
            </div>
            ${
              ticketCode
                ? `<p style="color: ${MUTED}; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; margin: 10px 0 0 0;">Ticket ID: ${ticketCode}</p>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    const imageHtml = eventImage
      ? `<img src="${escapeHtml(eventImage)}" alt="Event" style="border: 0; border-radius: 14px; display: block; margin: 0 0 22px 0; max-height: 260px; object-fit: cover; width: 100%;" />`
      : "";

    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: isDelayedReconciliation
        ? "Your Skaute access pass is ready"
        : "Your Skaute access pass",
      html: emailShell(`
        ${imageHtml}
        ${eyebrowHtml("Access confirmed")}
        ${headingHtml("Your pass is ready.")}
        ${paragraphHtml(
          isDelayedReconciliation
            ? "Your payment has been reconciled and your access pass is now confirmed."
            : "Your booking is confirmed. Keep this email handy and present your check-in code at the venue.",
        )}
        ${ticketListHtml}
        ${paragraphHtml(
          "For a smooth entry, bring a valid ID and use the same name or email attached to your booking where requested.",
        )}
      `),
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Ticket Failure: ${error.message}`);
    throw error;
  }
};

export const sendRefundEmail = async (to: string, ticket: any) => {
  const tierName = ticket.tierName || "your access pass";
  const ticketCode = escapeHtml(ticket.ticketCode);

  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: "Refund confirmation from Skaute",
      html: emailShell(`
        ${eyebrowHtml("Refund confirmed")}
        ${headingHtml("Your refund has been initiated.")}
        ${paragraphHtml(
          `The pass for ${tierName} has been cancelled and the refund process has started.`,
        )}
        <div style="background-color: ${CREAM}; border: 1px solid ${BORDER}; border-radius: 14px; margin: 24px 0; padding: 20px;">
          <p style="color: ${SLATE}; font-family: Arial, sans-serif; font-size: 12px; font-weight: 800; line-height: 1.4; margin: 0 0 8px 0; text-transform: uppercase;">
            Amount reversed
          </p>
          <p style="color: ${CORAL_ORANGE}; font-family: Arial, sans-serif; font-size: 30px; font-weight: 900; line-height: 1.2; margin: 0;">
            ${formatCurrency(ticket.pricePaid)}
          </p>
        </div>
        ${paragraphHtml(
          "Refunds are processed through Paystack. Most banks complete the reversal within 3 to 5 business days.",
        )}
        ${
          ticketCode
            ? `<p style="color: ${MUTED}; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; margin: 22px 0 0 0;">Ticket ID: ${ticketCode}</p>`
            : ""
        }
      `),
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
  const safeName = organizerName || "there";
  const safeTitle = eventTitle || "your event";
  const safeReason = escapeHtml(
    reason || "Our team needs a few updates before this can go live.",
  );

  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: isApproved
        ? "Your Skaute event is live"
        : "Update required for your Skaute event",
      html: emailShell(`
        ${eyebrowHtml(isApproved ? "Event approved" : "Review update")}
        ${headingHtml(isApproved ? "Your event is live." : "Your event needs a few updates.")}
        ${paragraphHtml(`Hello ${safeName},`)}
        ${paragraphHtml(
          isApproved
            ? `${safeTitle} has passed review and is now visible on Skaute.`
            : `${safeTitle} has been reviewed, but it needs changes before it can be published.`,
        )}
        <div style="background-color: ${isApproved ? "#F0FDF4" : CREAM}; border: 1px solid ${isApproved ? "#BBF7D0" : BORDER}; border-left: 4px solid ${isApproved ? "#16A34A" : CORAL_ORANGE}; border-radius: 14px; color: ${SLATE}; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; margin: 24px 0; padding: 18px;">
          ${
            isApproved
              ? "Your event is available for discovery. You can continue managing details from your organizer dashboard."
              : safeReason
          }
        </div>
        ${buttonHtml(isApproved ? "View Discover Feed" : "Review Event", DISCOVER_URL)}
      `),
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
  const safeName = buyerName || "there";
  const safeTitle = eventTitle || "your event";

  try {
    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: `${safeTitle} has been cancelled`,
      html: emailShell(`
        ${eyebrowHtml("Event cancelled")}
        ${headingHtml(`Hello ${safeName},`)}
        ${paragraphHtml(
          `${safeTitle} has been cancelled by the organizer. Your ticket is no longer valid for entry.`,
        )}
        ${paragraphHtml(
          "If you paid for this ticket, the refund process has started automatically. Your bank may take 3 to 5 business days to complete the reversal.",
        )}
        ${buttonHtml("Find another experience", DISCOVER_URL)}
      `),
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error: any) {
    logger.error(`Resend Cancellation Service Failure: ${error.message}`);
    throw error;
  }
};
