import { z } from "zod";

export const bookTicketSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID"),
    tierName: z.string().min(1, "Please select a ticket tier"),
    quantity: z.number().int().positive().default(1),
    discountCode: z.string().optional(),
    eventTitle: z.string().optional(),
  }),
});

export const validateCheckInSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID"),
  }),
  body: z.object({
    checkInCode: z.string().min(5, "Invalid QR code format").trim(),
    deviceFingerprint: z.string().trim().optional(),
  }),
});

export const syncTicketsSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Event ID"),
  }),
  query: z.object({
    // 'since' is a timestamp string from the URL, so we transform it to a number
    since: z.string().optional().default("0"),
  }),
});
export const refundTicketSchema = z.object({
  params: z.object({
    ticketCode: z.string().min(5, "Invalid ticket code"),
  }),
});

export type SyncTicketsParams = z.infer<typeof syncTicketsSchema>["params"];
export type SyncTicketsQuery = z.infer<typeof syncTicketsSchema>["query"];

export type BookTicketInput = z.infer<typeof bookTicketSchema>["body"];
export type ValidateCheckInInput = z.infer<
  typeof validateCheckInSchema
>["body"];
export type ValidateCheckInParams = z.infer<
  typeof validateCheckInSchema
>["params"];
