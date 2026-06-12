import { z } from "zod";

const hotspotCategories = [
  "nightlife",
  "lounge",
  "localeats",
  "dining",
  "parks",
  "lifestyle",
  "workspace",
  "wellness",
  "other",
  "others",
] as const;

// Helper for validating MongoDB ObjectIDs
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid Hotspot or User ID");

export const createHotspotSchema = z.object({
  body: z.object({
    title: z.string().min(1, "A hotspot must have a title").trim(),
    description: z.string().min(1, "A hotspot must have a description"),
    category: z.enum(hotspotCategories),
    status: z
      .enum(["CHILL", "ACTIVE", "TRENDING", "HOT"])
      .optional()
      .default("CHILL"),
    location: z.object({
      coordinates: z
        .tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ])
        .or(
          z
            .array(z.number())
            .length(2, "Coordinates must be exactly [longitude, latitude]"),
        ),
      address: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional().default("Port Harcourt"),
      state: z.string().optional().default("Rivers State"),
    }),
    priceTier: z.enum(["₦", "₦₦", "₦₦₦", "₦₦₦₦"]).optional().default("₦₦"),
    contact: z
      .object({
        phone: z.string().optional(),
        instagram: z.string().optional(),
        website: z.string().optional(),
      })
      .optional(),
    openingHours: z
      .array(
        z.object({
          day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
          open: z.string(), // "16:00"
          close: z.string(), // "02:00"
          isClosed: z.boolean().optional().default(false),
        }),
      )
      .optional()
      .default([]),
    activities: z
      .object({
        hasKaraoke: z.boolean().optional().default(false),
        hasLiveBand: z.boolean().optional().default(false),
        hasSnooker: z.boolean().optional().default(false),
        hasPoolside: z.boolean().optional().default(false),
        hasShisha: z.boolean().optional().default(false),
        hasVIPLounge: z.boolean().optional().default(false),
        hasOutdoorSeating: z.boolean().optional().default(false),
        hasArcadeGames: z.boolean().optional().default(false),
      })
      .optional(),
    features: z.array(z.string()).optional().default([]),
  }),
});

export const updateHotspotSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
  body: createHotspotSchema.shape.body.partial().extend({
    image: z.string().url("A valid cover image URL is required").optional(),
    gallery: z
      .array(z.string().url())
      .max(5, "Gallery cannot exceed 5 images")
      .optional(),
    location: createHotspotSchema.shape.body.shape.location.partial().optional(),
    contact: createHotspotSchema.shape.body.shape.contact.optional(),
    activities: createHotspotSchema.shape.body.shape.activities.optional(),
    analytics: z
      .object({
        viewCount: z.number().min(0).optional(),
        savedCount: z.number().min(0).optional(),
      })
      .optional(),
    bestTimeToVisit: z.string().optional(),
    claimedBy: objectIdSchema.nullable().optional(),
    energyLevel: z.number().min(0).optional(),
    energyRadius: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    isClaimed: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  }),
});

export const deleteHotspotSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
});

export const toggleHotspotActiveSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const castVibeCheckSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
  body: z.object({
    vibe: z.enum(["LIT", "LIVELY", "CHILL", "DULL"]),
  }),
});

export const getHotspotDetailsSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
});

export const createHotspotContributionSchema = z.object({
  params: z.object({
    hotspotId: objectIdSchema,
  }),
  body: z.object({
    type: z.enum([
      "photo",
      "pin",
      "hours",
      "contact",
      "description",
      "closed",
      "duplicate",
    ]),
    payload: z
      .object({
        value: z.string().trim().optional(),
        note: z.string().trim().optional(),
        imageUrl: z.string().url().optional(),
        coordinates: z
          .tuple([
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
          ])
          .optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .optional()
      .default({}),
    email: z.string().email().optional(),
    name: z.string().trim().optional(),
  }),
});

export const createHotspotSuggestionSchema = z
  .object({
    body: z.object({
      title: z.string().trim().min(1, "Title is required"),
      category: z.enum(hotspotCategories),
      location: z
        .object({
          address: z.string().trim().optional(),
          neighborhood: z.string().trim().optional(),
          city: z.string().trim().optional().default("Port Harcourt"),
          state: z.string().trim().optional().default("Rivers State"),
          coordinates: z
            .tuple([
              z.number().min(-180).max(180),
              z.number().min(-90).max(90),
            ])
            .optional(),
        })
        .optional()
        .default({ city: "Port Harcourt", state: "Rivers State" }),
      contact: z
        .object({
          phone: z.string().trim().optional(),
          website: z.string().trim().optional(),
          instagram: z.string().trim().optional(),
        })
        .optional()
        .default({}),
      note: z.string().trim().optional(),
      suggestedBy: z
        .object({
          name: z.string().trim().optional(),
          email: z.string().trim().email().optional(),
        })
        .optional()
        .default({}),
    }),
  })
  .superRefine((data, ctx) => {
    const location = data.body.location || {};
    if (!location.address && !location.neighborhood && !location.coordinates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "location"],
        message:
          "Please provide an address, neighborhood, or map coordinates for this hotspot.",
      });
    }
  });

export type CreateHotspotInput = z.infer<typeof createHotspotSchema>["body"];
export type UpdateHotspotInput = z.infer<typeof updateHotspotSchema>["body"];
export type CastVibeCheckInput = z.infer<typeof castVibeCheckSchema>["body"];
export type GetHotspotDetailsInput = z.infer<
  typeof getHotspotDetailsSchema
>["params"];
