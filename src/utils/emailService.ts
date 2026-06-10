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
                <div style="background-color: ${WHITE}; border-radius: 12px; height: 48px; padding: 8px 10px; width: 132px;">
                  <img src="${LOGO_PUBLIC_URL}" alt="Skaute" width="112" height="32" style="border: 0; display: block; height: 32px; max-width: 112px; object-fit: contain; width: 112px;" />
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

type TicketEmailContext = {
  event?: any;
  order?: any;
  isManualPlacement?: boolean;
};

const formatDateTime = (value: unknown) => {
  if (!value) return "";

  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
};

const getEventFromTicket = (tickets: any[], context?: TicketEmailContext) => {
  const ticketEvent = tickets.find((ticket) => {
    return ticket?.event && typeof ticket.event === "object";
  })?.event;

  return context?.event || ticketEvent;
};

const detailRowHtml = (label: string, value?: unknown) => {
  if (value === undefined || value === null || value === "") return "";

  return `
    <tr>
      <td style="border-bottom: 1px solid ${BORDER}; color: ${SLATE}; font-family: Arial, sans-serif; font-size: 12px; font-weight: 800; line-height: 1.5; padding: 12px 0; text-transform: uppercase; vertical-align: top; width: 38%;">
        ${escapeHtml(label)}
      </td>
      <td style="border-bottom: 1px solid ${BORDER}; color: ${MIDNIGHT_NAVY}; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; line-height: 1.5; padding: 12px 0 12px 14px; vertical-align: top;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
};

const sectionTitleHtml = (title: string) => `
  <h2 style="color: ${MIDNIGHT_NAVY}; font-family: Arial, sans-serif; font-size: 18px; font-weight: 900; letter-spacing: 0; line-height: 1.3; margin: 30px 0 12px 0;">
    ${escapeHtml(title)}
  </h2>
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
  context: TicketEmailContext = {},
) => {
  try {
    const event = getEventFromTicket(tickets, context);
    const order = context.order;
    const eventTitle = event?.title || "Your Skaute event";
    const eventStart = formatDateTime(event?.startDate);
    const eventEnd = formatDateTime(event?.endDate);
    const eventFormat = event?.eventFormat || (event?.isOnline ? "online" : "");
    const eventLocation = event?.isOnline
      ? "Online"
      : [event?.location?.address, event?.location?.neighborhood]
          .filter(Boolean)
          .join(", ");
    const eventCategory = event?.category;
    const refundPolicy = event?.refundPolicy;
    const ageRestriction = event?.ageRestriction;
    const imageSource = eventImage || event?.image;
    const firstTicket = tickets[0];
    const buyerName = [
      firstTicket?.buyerInfo?.firstName,
      firstTicket?.buyerInfo?.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    const quantity = order?.quantity || tickets.length;
    const totalAmount =
      order?.totalAmount !== undefined
        ? formatCurrency(order.totalAmount)
        : tickets.length
          ? formatCurrency(
              tickets.reduce(
                (sum, ticket) => sum + Number(ticket.pricePaid || 0),
                0,
              ),
            )
          : "";
    const paymentMethod = order?.paymentMethod
      ? String(order.paymentMethod).toUpperCase()
      : context.isManualPlacement
        ? "MANUAL"
        : "";
    const paymentReference = order?.paymentReference || "";

    const eventDetailsHtml = `
      ${sectionTitleHtml("Event details")}
      <div style="background-color: ${CREAM}; border: 1px solid ${BORDER}; border-radius: 14px; padding: 0 18px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${detailRowHtml("Event", eventTitle)}
          ${detailRowHtml("Starts", eventStart)}
          ${detailRowHtml("Ends", eventEnd)}
          ${detailRowHtml("Format", eventFormat)}
          ${detailRowHtml("Location", eventLocation)}
          ${detailRowHtml("Category", eventCategory)}
          ${detailRowHtml("Age", ageRestriction)}
          ${detailRowHtml("Refund policy", refundPolicy)}
        </table>
      </div>
    `;

    const orderSummaryHtml = `
      ${sectionTitleHtml("Order summary")}
      <div style="border: 1px solid ${BORDER}; border-radius: 14px; padding: 0 18px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          ${detailRowHtml("Name", buyerName)}
          ${detailRowHtml("Email", to)}
          ${detailRowHtml("Quantity", quantity)}
          ${detailRowHtml("Total paid", totalAmount)}
          ${detailRowHtml("Payment method", paymentMethod)}
          ${detailRowHtml("Reference", paymentReference)}
        </table>
      </div>
    `;

    const ticketListHtml = tickets
      .map((ticket) => {
        const rawCheckInCode =
          ticket.checkInCode || ticket.ticketCode || "Pending";
        const attendeeName = [
          ticket.buyerInfo?.firstName,
          ticket.buyerInfo?.lastName,
        ]
          .filter(Boolean)
          .join(" ");
        const tierName = escapeHtml(ticket.tierName || "Access Pass");
        const checkInCode = escapeHtml(rawCheckInCode);
        const ticketCode = escapeHtml(ticket.ticketCode);
        const pricePaid = formatCurrency(ticket.pricePaid);
        const status = ticket.status
          ? String(ticket.status).replace(/_/g, " ").toUpperCase()
          : "VALID";
        const qrCodeUrl = escapeHtml(
          ticket.qrCodeUrl ||
            ticket.qrCode ||
            `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
              rawCheckInCode,
            )}`,
        );

        return `
          <div style="border: 1px solid ${BORDER}; border-radius: 14px; margin: 0 0 16px 0; padding: 18px;">
            <p style="color: ${MIDNIGHT_NAVY}; font-family: Arial, sans-serif; font-size: 16px; font-weight: 900; line-height: 1.4; margin: 0 0 8px 0;">
              ${tierName}
            </p>
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin: 0 0 14px 0;">
              ${detailRowHtml("Attendee", attendeeName)}
              ${detailRowHtml("Ticket price", pricePaid)}
              ${detailRowHtml("Status", status)}
            </table>
            <p style="color: ${SLATE}; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; margin: 0 0 10px 0;">
              Present this QR code at check-in. If scanning is unavailable, the check-in team can use the code below.
            </p>
            <div style="background-color: ${WHITE}; border: 1px solid ${BORDER}; border-radius: 14px; margin: 14px 0; padding: 16px; text-align: center;">
              <img src="${qrCodeUrl}" alt="Ticket QR code for ${checkInCode}" width="180" height="180" style="border: 0; display: inline-block; height: 180px; max-width: 180px; width: 180px;" />
            </div>
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

    const imageHtml = imageSource
      ? `<img src="${escapeHtml(imageSource)}" alt="Event" style="border: 0; border-radius: 14px; display: block; margin: 0 0 22px 0; max-height: 260px; object-fit: cover; width: 100%;" />`
      : "";

    const { data, error } = await resend.emails.send({
      from: "Skaute <hello@skaute.com>",
      to,
      subject: isDelayedReconciliation
        ? "Your Skaute access pass is ready"
        : `Your access pass for ${eventTitle}`,
      html: emailShell(`
        ${imageHtml}
        ${eyebrowHtml("Access confirmed")}
        ${headingHtml(eventTitle)}
        ${paragraphHtml(
          isDelayedReconciliation
            ? "Your payment has been reconciled and your access pass is now confirmed."
            : "Your booking is confirmed. Keep this email handy; it contains your event details, order summary, and check-in QR code.",
        )}
        ${eventDetailsHtml}
        ${orderSummaryHtml}
        ${sectionTitleHtml(tickets.length > 1 ? "Your tickets" : "Your ticket")}
        ${ticketListHtml}
        ${paragraphHtml(
          "For a smooth entry, arrive with a valid ID and use the same name or email attached to your booking where requested. Do not share your QR code publicly.",
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
