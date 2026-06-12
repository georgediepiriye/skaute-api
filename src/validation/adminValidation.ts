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

export const bulkTicketIssueSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    guests: z
      .array(
        z.object({
          firstName: z.string().trim().min(1, "First name is required"),
          lastName: z.string().trim().min(1, "Last name is required"),
          email: z.string().trim().email("A valid email address is required"),
          tierId: objectIdSchema,
        }),
      )
      .min(1, "At least one guest is required")
      .max(500, "Bulk issue cannot exceed 500 guests at once"),
  }),
});

export const mapboxCandidateSchema = z.object({
  source: z.literal("mapbox").optional().default("mapbox"),
  sourceId: z.string().trim().min(1, "Mapbox source ID is required"),
  name: z.string().trim().min(1, "Venue name is required"),
  title: z.string().trim().optional(),
  address: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  sourceCategories: z.array(z.string()).optional().default([]),
  category: z
    .string()
    .trim()
    .optional()
    .default("other"),
  distanceMeters: z.number().optional(),
  alreadyExists: z.boolean().optional(),
  existingHotspotId: objectIdSchema.nullable().optional(),
  confidence: z.number().optional(),
});

export const mapboxHotspotPreviewSchema = z.object({
  body: z.object({
    category: z.string().trim().min(1, "Category is required"),
    area: z.string().trim().optional().default("Port Harcourt"),
    keyword: z.string().trim().optional(),
    radiusMeters: z.number().int().min(100).max(50000).optional().default(5000),
    limit: z.number().int().min(1).max(25).optional().default(25),
  }),
});

export const mapboxHotspotImportSchema = z.object({
  body: z
    .object({
      sourceIds: z.array(z.string().trim().min(1)).optional().default([]),
      candidates: z.array(mapboxCandidateSchema).optional().default([]),
    })
    .refine(
      (data) => data.sourceIds.length > 0 || data.candidates.length > 0,
      {
        message: "sourceIds or candidates are required",
        path: ["candidates"],
      },
    ),
});

const osmTagSchema = z.record(z.string().min(1), z.string().min(1));

export const osmHotspotPreviewSchema = z.object({
  body: z.object({
    source: z.literal("osm").optional().default("osm"),
    category: z.string().trim().min(1, "Category is required"),
    osmTag: osmTagSchema.optional(),
    osmTags: z.array(osmTagSchema).min(1, "At least one OSM tag is required"),
    area: z.string().trim().optional().default("Port Harcourt"),
    areaCenter: z
      .object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
      .optional(),
    bbox: z
      .tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ])
      .optional(),
    overpassBbox: z.tuple([
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
    ]),
    country: z.string().trim().length(2).optional().default("NG"),
    keyword: z.string().trim().optional().default(""),
    radiusMeters: z.number().int().min(100).max(50000).optional().default(5000),
    limit: z.number().int().min(1).max(50).optional().default(25),
    rejectNamePattern: z.string().trim().optional(),
  }),
});

export const hotspotContributionReviewSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    adminNote: z.string().trim().optional(),
    applyMode: z.enum(["auto", "manual"]).optional().default("auto"),
  }),
});

export const adminHotspotSuggestionIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const updateHotspotSuggestionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    location: z
      .object({
        address: z.string().trim().optional(),
        neighborhood: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        coordinates: z
          .tuple([
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
          ])
          .optional(),
      })
      .optional(),
    contact: z
      .object({
        phone: z.string().trim().optional(),
        website: z.string().trim().optional(),
        instagram: z.string().trim().optional(),
      })
      .optional(),
    note: z.string().trim().optional(),
    adminNotes: z.string().trim().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
});

export const rejectHotspotSuggestionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    adminNotes: z.string().trim().optional(),
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

export type BulkTicketIssueInput = z.infer<
  typeof bulkTicketIssueSchema
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
