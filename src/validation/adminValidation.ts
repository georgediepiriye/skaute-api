import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ID format",
  });

// -----------------------------------
// COMMON PARAM SCHEMAS
// -----------------------------------

export const adminEventIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const adminUserIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const adminPayoutIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const adminTelemetryEventParamSchema = z.object({
  params: z.object({
    eventId: objectIdSchema,
  }),
});

// -----------------------------------
// EVENT APPROVAL / REJECTION
// -----------------------------------

export const processApprovalSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z
    .object({
      status: z.enum(["approved", "rejected"]),

      reason: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.status === "rejected" &&
        (!data.reason || data.reason.trim().length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Rejection reason is required",
        });
      }
    }),
});

// -----------------------------------
// EVENT PROMOTION
// -----------------------------------

export const updateEventPromotionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    statusArray: z.array(z.string()).optional(),

    isSkauteHosted: z.boolean().optional(),

    isBoosted: z.boolean().optional(),

    boostTier: z.enum(["none", "standard", "premium"]).optional(),

    boostDays: z.number().int().positive().optional(),
  }),
});

// -----------------------------------
// USER MANAGEMENT
// -----------------------------------

export const toggleUserStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    status: z.enum(["active", "suspended"]),
  }),
});

export const toggleUserVerificationSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    isVerified: z.boolean(),
  }),
});

// -----------------------------------
// PAYOUT MANAGEMENT
// -----------------------------------

export const completeManualPayoutSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    reference: z
      .string()
      .trim()
      .min(
        1,
        "A payment reference string is strictly required to resolve a manual settlement trace.",
      ),
  }),
});

// -----------------------------------
// TYPES
// -----------------------------------

export type ProcessApprovalInput = z.infer<
  typeof processApprovalSchema
>["body"];

export type UpdateEventPromotionInput = z.infer<
  typeof updateEventPromotionSchema
>["body"];

export type ToggleUserStatusInput = z.infer<
  typeof toggleUserStatusSchema
>["body"];

export type ToggleUserVerificationInput = z.infer<
  typeof toggleUserVerificationSchema
>["body"];

export type CompleteManualPayoutInput = z.infer<
  typeof completeManualPayoutSchema
>["body"];
