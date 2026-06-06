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

  // Base blend score configuration
  let baselineEnergy = (heat * 0.6 + freshness * 0.4) * 100;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  const isWeekend = currentDay === 0 || currentDay === 5 || currentDay === 6;

  let timeWindowModifier = 1.0;

  // 1. Nightlife & Lounges Strategy
  if (this.category === "nightlife" || this.category === "lounge") {
    if (currentHour >= 5 && currentHour < 19) {
      timeWindowModifier = 0.05; // Drop daytime club/lounge false positives directly to zero
    } else if (!isWeekend && currentHour >= 23) {
      timeWindowModifier = 0.75; // Adjust expectations dynamically down during weekday midnight windows
    }
  }
  // 2. Co-Working Spaces Strategy
  else if (this.category === "workspace") {
    if (currentHour >= 19 || currentHour < 7 || isWeekend) {
      timeWindowModifier = 0.05; // De-escalate office data spaces completely when doors are locked
    }
  }
  // 3. Joints & Local Eats (Bole / Bukas) Strategy
  else if (this.category === "localeats") {
    if (currentHour >= 21 || currentHour < 9) {
      timeWindowModifier = 0.1; // Extinguish food spot data markers completely at late night periods
    }
  }

  return Math.round(
    Math.max(0, Math.min(100, baselineEnergy * timeWindowModifier)),
  );
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
