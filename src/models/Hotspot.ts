import mongoose, { HydratedDocument, Types } from "mongoose";

// Mapped precisely to match your upgraded Nigerian social context categories
const hotspotCategorySlugs = [
  "nightlife",
  "lounge",
  "localeats",
  "dining",
  "parks",
  "lifestyle",
  "workspace",
  "wellness",
  "others",
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
  weight: number;
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

// 🛡️ FIXED: Removed 'expires' to shield the parent hotspot document from complete DB drops
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
    },
    weight: { type: Number, default: 1.0 },
  },
  { _id: false },
);

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
  source?: "manual" | "osm" | "mapbox" | "user";
  sourceId?: string;
  mapboxId?: string;
  osmId?: string;
  osmType?: "node" | "way" | "relation";
  sourceCategories?: string[];
  importStatus?: "needs_review" | "in_review" | "verified" | "rejected";
  importedBy?: Types.ObjectId;
  importedAt?: Date;
  lastContributionAt?: Date;
}

export type HotspotDocument = HydratedDocument<IHotspot> & {
  vibeScore: number;
  heatIntensity: number;
  vibeFreshness: number;
  energyScore: number;
  computedAuraRadius: number;
};

/**
 * =========================
 * HOTSPOT SCHEMA
 * =========================
 */
const hotspotSchema = new mongoose.Schema<HotspotDocument>(
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
      default: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
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
    source: {
      type: String,
      enum: ["manual", "osm", "mapbox", "user"],
      default: "manual",
      index: true,
    },
    sourceId: {
      type: String,
      index: true,
    },
    mapboxId: {
      type: String,
      index: true,
    },
    osmId: {
      type: String,
      index: true,
    },
    osmType: {
      type: String,
      enum: ["node", "way", "relation"],
    },
    sourceCategories: [String],
    importStatus: {
      type: String,
      enum: ["needs_review", "in_review", "verified", "rejected"],
      default: undefined,
      index: true,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    importedAt: Date,
    lastContributionAt: Date,
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
hotspotSchema.index({ source: 1, sourceId: 1 });
hotspotSchema.index({ isActive: 1 });
hotspotSchema.index({ isVerified: 1 });

/**
 * ==========================================
 * VIRTUALS (With Context-Aware Decay Logic)
 * ==========================================
 */
hotspotSchema.virtual("allPhotos").get(function (this: HotspotDocument) {
  return [this.image, ...(this.gallery || [])];
});

hotspotSchema.virtual("upcomingMoves", {
  ref: "Move",
  localField: "_id",
  foreignField: "venueHotspotId",
});

// A freshness percentage slider scaling smoothly from 1.0 down to 0.0 over an active 3-hour window
hotspotSchema.virtual("vibeFreshness").get(function (this: HotspotDocument) {
  const last = this.lastVibeActivityAt?.getTime() || Date.now();
  const ageHours = (Date.now() - last) / (1000 * 60 * 60);

  if (ageHours >= 3) return 0;
  // Cubic curve optimization drops older analytics faster than simple linear sliders
  return Math.max(0, Math.pow(1 - ageHours / 3, 3));
});

// Drops out to zero if there's been no action at the location within the core 3-hour block
hotspotSchema.virtual("vibeScore").get(function (this: HotspotDocument) {
  const freshness = this.vibeFreshness || 0;
  if (freshness === 0) return 0;

  const c = this.vibeCheck?.counts;
  if (!c) return 0;

  const rawScore =
    (c.lit || 0) * 4 +
    (c.lively || 0) * 3 +
    (c.chill || 0) * 2 +
    (c.dull || 0) * 1;

  return rawScore * freshness;
});

// Calculates ratio of vote values vs perfect score capacity
hotspotSchema.virtual("heatIntensity").get(function (this: HotspotDocument) {
  const c = this.vibeCheck?.counts;
  if (!c) return 0;

  const votes = (c.lit || 0) + (c.lively || 0) + (c.chill || 0) + (c.dull || 0);
  if (votes === 0) return 0;

  return Math.min((this.vibeScore || 0) / (votes * 4), 1);
});

// Context Engine: Evaluates live telemetry against Category Lifecycle and Time constraints
hotspotSchema.virtual("energyScore").get(function (this: HotspotDocument) {
  const freshness = this.vibeFreshness || 0;
  if (freshness === 0) return 0;

  const heat = this.heatIntensity || 0;
  const now = new Date();
  const hour = now.getHours();

  // 1. Define Category Profiles (Start hour, End hour, Peak intensity)
  const categoryProfiles: Record<
    string,
    { start: number; end: number; peak: number }
  > = {
    nightlife: { start: 20, end: 5, peak: 1.2 }, // 8 PM to 5 AM
    lounge: { start: 16, end: 2, peak: 1.1 }, // 4 PM to 2 AM
    localeats: { start: 8, end: 20, peak: 1.3 }, // 8 AM to 8 PM
    dining: { start: 12, end: 23, peak: 1.0 }, // 12 PM to 11 PM
    workspace: { start: 8, end: 18, peak: 1.0 }, // 8 AM to 6 PM
    wellness: { start: 6, end: 20, peak: 1.0 }, // 6 AM to 8 PM
    lifestyle: { start: 9, end: 21, peak: 1.0 }, // 9 AM to 9 PM
    parks: { start: 7, end: 19, peak: 1.0 }, // 7 AM to 7 PM
  };

  const profile = categoryProfiles[this.category] || {
    start: 0,
    end: 23,
    peak: 1.0,
  };

  // 2. Calculate if we are in the "Active" window
  let isOpen = false;
  if (profile.start < profile.end) {
    isOpen = hour >= profile.start && hour < profile.end;
  } else {
    // Handles overnight ranges like 10 PM (22) to 5 AM (5)
    isOpen = hour >= profile.start || hour < profile.end;
  }

  if (!isOpen) return 10; // Low "ambient" energy if closed, but not invisible (10%)

  // 3. Final Score Calculation
  // We use the heat (user votes) and boost it if we are in the category's natural peak window
  const baseline = (heat * 0.7 + freshness * 0.3) * 100;
  return Math.round(Math.min(100, baseline * profile.peak));
});

// Controls Map Aura graphic scale properties based on pure dynamic runtime engine scores
hotspotSchema.virtual("computedAuraRadius").get(function (
  this: HotspotDocument,
) {
  const baseRadius = 20;
  const energy = this.energyScore || 0;

  return baseRadius + energy * 1.2;
});

const Hotspot =
  (mongoose.models.Hotspot as mongoose.Model<HotspotDocument>) ||
  mongoose.model<HotspotDocument>("Hotspot", hotspotSchema);

export default Hotspot;
