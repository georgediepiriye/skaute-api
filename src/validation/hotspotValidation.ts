import { z } from "zod";

// Helper for validating MongoDB ObjectIDs
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid Hotspot or User ID");

export const createHotspotSchema = z.object({
  body: z.object({
    title: z.string().min(1, "A hotspot must have a title").trim(),
    description: z.string().min(1, "A hotspot must have a description"),
    category: z.string().min(1, "A hotspot must have a category"),
    status: z
      .enum(["CHILL", "ACTIVE", "TRENDING", "HOT"])
      .optional()
      .default("CHILL"),
    image: z.string().url("A valid cover image URL is required"),
    gallery: z
      .array(z.string().url())
      .max(5, "Gallery cannot exceed 5 images")
      .optional()
      .default([]),
    location: z.object({
      coordinates: z
        .array(z.number())
        .length(2, "Coordinates must be exactly [longitude, latitude]"),
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
        hasLiveBand: { type: Boolean, default: false },
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

export type CreateHotspotInput = z.infer<typeof createHotspotSchema>["body"];
export type CastVibeCheckInput = z.infer<typeof castVibeCheckSchema>["body"];
export type GetHotspotDetailsInput = z.infer<
  typeof getHotspotDetailsSchema
>["params"];
