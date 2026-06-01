import mongoose from "mongoose";
import { HOTSPOT_CATEGORIES } from "../lib/constants.js";

const hotspotCategorySlugs = Object.values(HOTSPOT_CATEGORIES).map(
  (cat) => cat.slug,
);

// ⏱️ VIBE VOTE SUB-SCHEMA (Self-cleaning via MongoDB TTL index)
const vibeVoteSchema = new mongoose.Schema({
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
    expires: 21600,
  },
});

const hotspotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "A hotspot must have a title"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "A hotspot must have a description"],
    },
    category: {
      type: String,
      enum: {
        values: [...hotspotCategorySlugs, "other"],
        message: "{VALUE} is not a supported hotspot category",
      },
      default: "other",
    },
    status: {
      type: String,
      enum: ["CHILL", "ACTIVE", "TRENDING", "HOT"],
      default: "CHILL",
    },
    image: {
      type: String,
      required: [true, "A hotspot must have a cover image"],
    },
    gallery: {
      type: [String],
      validate: {
        validator: function (val: string | any[]) {
          return val.length <= 5;
        },
        message: "Gallery cannot exceed 5 images",
      },
    },
    location: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: String,
      neighborhood: String,
      city: {
        type: String,
        default: "Port Harcourt",
      },
      state: {
        type: String,
        default: "Rivers State",
      },
    },

    // 🌟 REAL-TIME VIBE CHECK REPLACEMENT SYSTEM
    vibeCheck: {
      votes: [vibeVoteSchema], // Holds active votes within the 6-hour sliding window
      currentVibe: {
        type: String,
        enum: ["LIT", "LIVELY", "CHILL", "DULL", "UNKNOWN"],
        default: "UNKNOWN",
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // 🎯 AMENITIES & FEATURES CHECKLIST
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

    // 🏷️ LOOKUP SLUGS FOR HIGH-SPEED FILTERING
    features: {
      type: [String],
      index: true, // Optimizes key filtering loops
    },

    // 🌟 B2B & PARTNERSHIP FIELDS
    isVerified: {
      type: Boolean,
      default: true,
    },
    isClaimed: {
      type: Boolean,
      default: false, // Becomes true once a real venue owner signs up and takes it over
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Links to the venue manager's account record
      default: null,
    },

    // 🌟 BUSINESS DETAILS (Crucial for user discovery)
    priceTier: {
      type: String,
      enum: ["₦", "₦₦", "₦₦₦", "₦₦₦₦"], // Affordable, Moderate, Premium, Ultra-Lux
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
        open: String, // e.g., "16:00"
        close: String, // e.g., "02:00"
        isClosed: { type: Boolean, default: false },
      },
    ],

    // 🌟 TRAFFIC & POPULARITY METRICS
    analytics: {
      viewCount: { type: Number, default: 0 },
      savedCount: { type: Number, default: 0 },
    },

    bestTimeToVisit: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Index for proximity searches
hotspotSchema.index({ location: "2dsphere" });

// Upgraded compound text index to search title, neighborhood, and features instantly
hotspotSchema.index({
  title: "text",
  "location.neighborhood": "text",
  features: "text",
});

/**
 * VIRTUAL: Full Gallery
 */
hotspotSchema.virtual("allPhotos").get(function () {
  return [this.image, ...(this.gallery || [])];
});

/**
 * 🌟 VIRTUAL: Upcoming Moves
 * Pulls all future event listings linked directly to this venue location
 * so they instantly populate on the venue's detail page tab layout.
 */
hotspotSchema.virtual("upcomingMoves", {
  ref: "Move", // Assuming your event schema is called 'Move'
  localField: "_id",
  foreignField: "venueHotspotId", // Put this reference key in your Move/Event schema!
});

const Hotspot =
  mongoose.models.Hotspot || mongoose.model("Hotspot", hotspotSchema);

export default Hotspot;
