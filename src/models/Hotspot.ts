import mongoose, { HydratedDocument, Types } from "mongoose";

// Mocking this constant layout to keep your schema code sound.
// Ensure your actual import path points precisely to your constants file.
const hotspotCategorySlugs = [
  "nightlife",
  "lounge",
  "dining",
  "cafe",
  "workspace",
  "arts",
  "wellness",
  "retail",
];

/**
 * =========================
 * SUB-DOCUMENT TYPES
 * =========================
 */
interface IVibeVote {
  userId: Types.ObjectId | string;
  vibe: "LIT" | "LIVELY" | "CHILL" | "DULL";
  createdAt?: Date;
}

interface IVibeCheck {
  votes: mongoose.Types.DocumentArray<IVibeVote & mongoose.Types.Subdocument>;
  currentVibe: "LIT" | "LIVELY" | "CHILL" | "DULL" | "UNKNOWN";
  totalVotes: number;
  counts: {
    lit: number;
    lively: number;
    chill: number;
    dull: number;
  };
  lastUpdated: Date;
}

const vibeVoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vibe: {
      type: String,
      enum: ["LIT", "LIVELY", "CHILL", "DULL"],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 21600, // Automatic document cleanup after 6 hours
    },
  },
  { _id: false },
);

/**
 * =========================
 * HOTSPOT SCHEMA
 * =========================
 */
const hotspotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    category: {
      type: String,
      enum: [...hotspotCategorySlugs, "other"],
      default: "other",
      index: true,
    },

    status: {
      type: String,
      enum: ["CHILL", "ACTIVE", "TRENDING", "HOT"],
      default: "CHILL",
      index: true,
    },

    image: { type: String, required: true },

    gallery: {
      type: [String],
      validate: {
        validator: (val: string[]) => val.length <= 5,
        message: "Gallery cannot exceed 5 images",
      },
    },

    location: {
      type: { type: String, default: "Point", enum: ["Point"] },
      coordinates: { type: [Number], required: true },
      address: String,
      neighborhood: String,
      city: { type: String, default: "Port Harcourt" },
      state: { type: String, default: "Rivers State" },
    },

    vibeCheck: {
      votes: [vibeVoteSchema],
      currentVibe: {
        type: String,
        enum: ["LIT", "LIVELY", "CHILL", "DULL", "UNKNOWN"],
        default: "UNKNOWN",
        index: true,
      },
      totalVotes: { type: Number, default: 0 },
      counts: {
        lit: { type: Number, default: 0 },
        lively: { type: Number, default: 0 },
        chill: { type: Number, default: 0 },
        dull: { type: Number, default: 0 },
      },
      lastUpdated: { type: Date, default: Date.now },
    },

    lastVibeActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    decayAt: {
      type: Date,
      default: () => new Date(Date.now() + 6 * 60 * 60 * 1000),
      index: true,
    },

    energyRadius: { type: Number, default: 25 },
    energyLevel: { type: Number, default: 0 },

    activities: {
      hasKaraoke: { type: Boolean, default: false },
      hasLiveBand: { type: Boolean, default: false },
      hasSnooker: { type: Boolean, default: false },
      hasPoolside: { type: Boolean, default: false },
      hasShisha: { type: Boolean, default: false },
      hasVIPLounge: { type: Boolean, default: false },
      hasOutdoorSeating: { type: Boolean, default: false },
      hasArcadeGames: { type: Boolean, default: false },
    },

    features: { type: [String], index: true },
    isVerified: { type: Boolean, default: true },
    isClaimed: { type: Boolean, default: false },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    priceTier: {
      type: String,
      enum: ["₦", "₦₦", "₦₦₦", "₦₦₦₦"],
      default: "₦₦",
    },

    contact: {
      phone: String,
      instagram: String,
      website: String,
    },

    openingHours: [
      {
        day: {
          type: String,
          enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },
        open: String,
        close: String,
        isClosed: { type: Boolean, default: false },
      },
    ],

    analytics: {
      viewCount: { type: Number, default: 0 },
      savedCount: { type: Number, default: 0 },
    },

    bestTimeToVisit: String,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * =========================
 * INDEXES
 * =========================
 */
hotspotSchema.index({ location: "2dsphere" });
hotspotSchema.index({
  title: "text",
  "location.neighborhood": "text",
  features: "text",
});

/**
 * =========================
 * VIRTUALS
 * =========================
 */
hotspotSchema.virtual("allPhotos").get(function () {
  return [this.image, ...(this.gallery || [])];
});

hotspotSchema.virtual("upcomingMoves", {
  ref: "Move",
  localField: "_id",
  foreignField: "venueHotspotId",
});

hotspotSchema.virtual("vibeScore").get(function () {
  const c = this.vibeCheck?.counts;
  if (!c) return 0;
  // Fallbacks applied dynamically to handle pristine unvoted document initialization gracefully
  return (
    (c.lit || 0) * 4 +
    (c.lively || 0) * 3 +
    (c.chill || 0) * 2 +
    (c.dull || 0) * 1
  );
});

hotspotSchema.virtual("heatIntensity").get(function (this: any) {
  const c = this.vibeCheck?.counts;
  if (!c) return 0;

  const votes = (c.lit || 0) + (c.lively || 0) + (c.chill || 0) + (c.dull || 0);
  if (votes === 0) return 0;

  return Math.min((this.vibeScore || 0) / (votes * 4), 1);
});

hotspotSchema.virtual("vibeFreshness").get(function (this: any) {
  const last = this.lastVibeActivityAt?.getTime?.() || Date.now();
  const ageHours = (Date.now() - last) / (1000 * 60 * 60);

  return Math.max(0, 1 - ageHours / 6);
});

hotspotSchema.virtual("energyScore").get(function (this: any) {
  const heat = this.heatIntensity || 0;
  const freshness = this.vibeFreshness || 0;

  return Math.round((heat * 0.7 + freshness * 0.3) * 100);
});

hotspotSchema.virtual("computedAuraRadius").get(function (this: any) {
  const base = 20;
  const energy = this.energyScore || 0;

  return base + energy * 1.2;
});

/**
 * =========================
 * TYPE SAFETY INTERFACES
 * =========================
 */
export interface IHotspot {
  title: string;
  description: string;
  category: string;
  status: "CHILL" | "ACTIVE" | "TRENDING" | "HOT";
  image: string;
  gallery?: string[];
  location: {
    type: "Point";
    coordinates: number[];
    address?: string;
    neighborhood?: string;
    city: string;
    state: string;
  };
  vibeCheck: IVibeCheck;
  lastVibeActivityAt: Date;
  decayAt: Date;
  energyRadius: number;
  energyLevel: number;
  activities: {
    hasKaraoke: boolean;
    hasLiveBand: boolean;
    hasSnooker: boolean;
    hasPoolside: boolean;
    hasShisha: boolean;
    hasVIPLounge: boolean;
    hasOutdoorSeating: boolean;
    hasArcadeGames: boolean;
  };
  features?: string[];
  isVerified: boolean;
  isClaimed: boolean;
  claimedBy?: Types.ObjectId | null;
  priceTier: "₦" | "₦₦" | "₦₦₦" | "₦₦₦₦";
  contact?: {
    phone?: string;
    instagram?: string;
    website?: string;
  };
  openingHours?: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    open: string;
    close: string;
    isClosed: boolean;
  }>;
  analytics: {
    viewCount: number;
    savedCount: number;
  };
  bestTimeToVisit?: string;
  isActive: boolean;
}

export type HotspotDocument = HydratedDocument<IHotspot> & {
  vibeScore: number;
  heatIntensity: number;
  vibeFreshness: number;
  energyScore: number;
  computedAuraRadius: number;
};

const Hotspot =
  (mongoose.models.Hotspot as mongoose.Model<HotspotDocument>) ||
  mongoose.model<HotspotDocument>("Hotspot", hotspotSchema);

export default Hotspot;
