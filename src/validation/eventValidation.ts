import { z } from "zod";
import { EVENT_CATEGORIES, EVENT_TYPES } from "../lib/constants.js";
import mongoose from "mongoose";

const eventBodyShape = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title cannot exceed 100 characters"),
  slug: z
    .string()
    .min(3, "Custom link must be at least 3 characters")
    .max(50, "Custom link is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Custom link can only contain letters, numbers, and hyphens",
    ),
  description: z
    .string()
    .min(20, "Please provide a more detailed description (min 20 chars)"),

  eventFormat: z.enum(["physical", "online", "hybrid"]).default("physical"),
  isOnline: z.boolean().default(false),

  type: z.enum(Object.keys(EVENT_TYPES) as [string, ...string[]]),
  category: z.enum(Object.keys(EVENT_CATEGORIES) as [string, ...string[]]),
  tags: z.array(z.string()).optional().default([]),

  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Please provide a valid start date and time",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Please provide a valid end date and time",
  }),

  location: z
    .object({
      type: z.literal("Point").default("Point"),
      coordinates: z.tuple([
        z.number().min(-180).max(180), // lng
        z.number().min(-90).max(90), // lat
      ]),
      address: z.string().min(1, "Address is required"),
      neighborhood: z.string().optional().default("Port Harcourt"),
    })
    .optional()
    .nullable(),

  isPublic: z.boolean().default(true),
  allowAnonymous: z.boolean().default(true),
  ageRestriction: z.string().default("All Ages"),

  ticketingType: z.enum(["none", "internal", "external"]).default("none"),
  joinLink: z
    .string()
    .url("Invalid Join Link")
    .nullable()
    .optional()
    .or(z.literal("")),
  meetingLink: z
    .string()
    .url("Invalid Meeting Link")
    .nullable()
    .optional()
    .or(z.literal("")),
  communityLink: z
    .string()
    .url("Invalid Community Link")
    .nullable()
    .optional()
    .or(z.literal("")),
  externalTicketLink: z
    .string()
    .url("Invalid External Ticket URL")
    .nullable()
    .optional()
    .or(z.literal("")),

  ticketTiers: z
    .array(
      z.object({
        name: z.string().min(1, "Tier name is required"),
        price: z.number().min(0),
        capacity: z.number().int().positive(),
        description: z.string().optional(),
        sold: z.number().optional().default(0), // Added for your ticketing check
      }),
    )
    .optional()
    .default([]),

  isRecurring: z.boolean().default(false),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
      interval: z.number().int().min(1).default(1),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
      endDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid recurrence end date",
        })
        .optional(),
    })
    .optional(),

  refundPolicy: z.enum(["none", "flexible", "24h"]).default("none"),
  organizerType: z.enum(["individual", "business"]).default("individual"),
});

// 2. CREATE EVENT SCHEMA (With all refinements)
export const createEventSchema = z.object({
  body: eventBodyShape
    .refine(
      (data) => {
        const start = new Date(data.startDate).getTime();
        const end = new Date(data.endDate).getTime();
        return end > start;
      },
      {
        message: "End date must be after the start date",
        path: ["endDate"],
      },
    )
    .refine(
      (data) => (data.eventFormat !== "online" ? !!data.location : true),
      {
        message: "Location is required for physical and hybrid events",
        path: ["location"],
      },
    )
    .refine(
      (data) => (data.eventFormat !== "physical" ? !!data.meetingLink : true),
      {
        message: "Meeting link is required for virtual access",
        path: ["meetingLink"],
      },
    )
    .refine(
      (data) => {
        if (data.ticketingType === "internal" && data.ticketTiers.length === 0)
          return false;
        if (data.ticketingType === "external" && !data.externalTicketLink)
          return false;
        return true;
      },
      {
        message:
          "Please complete the ticketing requirements for your selected type.",
        path: ["ticketingType"],
      },
    )
    .refine(
      (data) =>
        data.isRecurring ? data.recurrence?.frequency !== "none" : true,
      {
        message: "Please specify frequency for recurring events",
        path: ["recurrence"],
      },
    ),
});

// 3. UPDATE EVENT SCHEMA (Partial body, no mandatory refinements)
export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid Event ID",
    }),
  }),
  // We call .partial() on the RAW shape to avoid the Zod Error
  body: eventBodyShape.partial(),
});

export const eventIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
});

export const addCoOrganizerSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid partner email")
      .lowercase()
      .trim(),
    permissions: z
      .array(
        z.enum([
          "view_revenue",
          "issue_refunds",
          "send_broadcasts",
          "scan_tickets",
        ]),
      )
      .optional()
      .default(["scan_tickets"]),
  }),
});

export const removeCoOrganizerSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
    partnerId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid Partner ID format"),
  }),
});

export const createDiscountValidation = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
  body: z.object({
    code: z
      .string()
      .min(3)
      .max(15)
      .regex(/^[A-Z0-9]+$/)
      .trim(),
    discountPercentage: z.number().min(1).max(100),
    usageLimit: z.number().int().positive().min(1).nullable().optional(),
    applicableTickets: z.array(z.string()).optional(),
    expiryDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid expiry date/time format",
      }),
  }),
});

export const deleteDiscountValidation = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
    discountId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid Discount ID format"),
  }),
});

export const validateDiscountValidation = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
  body: z.object({
    code: z
      .string()
      .min(1, "Discount code is required")
      .trim()
      .transform((val) => val.toUpperCase()), // Auto-normalize input
    tierName: z.string().min(1, "Ticket tier name is required").trim(),
  }),
});

export const updateCoOrganizerPermissionsValidation = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
  body: z.object({
    coOrganizerId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid Co-Organizer User ID format"),
    permissions: z.array(z.string()).nonempty("cannot be completely empty"),
  }),
});

export const issueManualTicketValidation = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID format"),
  }),
  body: z.object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(40, "Name is too long")
      .trim(),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(40, "Name is too long")
      .trim(),
    email: z
      .string()
      .email("Please provide a valid attendee email address")
      .lowercase()
      .trim(),
    tierId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid ticket tier configuration ID"),
    // 🆕 Added validation for the offline payment channel chosen at the gate
    paymentMethod: z
      .enum(["cash", "transfer", "pos", "complimentary"])
      .default("cash"),
  }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>["body"];
export type EventIdParam = z.infer<typeof eventIdParamSchema>["params"];
export type AddCoOrganizerInput = z.infer<typeof addCoOrganizerSchema>;
export type RemoveCoOrganizerInput = z.infer<typeof removeCoOrganizerSchema>;
export type CreateDiscountInput = z.infer<typeof createDiscountValidation>;
export type ValidateDiscountInput = z.infer<typeof validateDiscountValidation>;
export type DeleteDiscountInput = z.infer<typeof deleteDiscountValidation>;
export type IssueManualTicketInput = z.infer<
  typeof issueManualTicketValidation
>;
