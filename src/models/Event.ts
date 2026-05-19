import mongoose, { Schema, Document } from "mongoose";
import {
  EventCategory,
  skauteType,
  EVENT_TYPES,
  EVENT_CATEGORIES,
} from "../lib/constants.js";
import { discountSchema, IDiscount } from "./Discount.js";

export type CoOrganizerPermission =
  | "view_revenue"
  | "issue_refunds"
  | "send_broadcasts"
  | "scan_tickets";

interface ITicketTier {
  name: string;
  price: number;
  capacity: number;
  sold: number;
  description?: string;
  salesEnd?: Date;
  isSoldOut?: boolean;
}

export interface ICoOrganizer {
  user: mongoose.Types.ObjectId;
  permissions: CoOrganizerPermission[];
  assignedAt: Date;
}

export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  type: skauteType;
  status: ("verified" | "featured")[];
  approvalStatus: "pending" | "approved" | "rejected";

  eventFormat: "physical" | "online" | "hybrid";
  isOnline: boolean;

  isPublic: boolean;
  allowAnonymous: boolean;

  location?: {
    type: "Point";
    coordinates: [number, number];
    address: string;
    neighborhood: string;
  };

  image: string;
  organizer: mongoose.Types.ObjectId;
  coOrganizers: ICoOrganizer[];
  organizerType: "individual" | "business";

  isFree: boolean;
  ticketingType: "none" | "internal" | "external";
  ticketTiers: ITicketTier[];
  discounts: IDiscount[];
  totalCapacity?: number;

  // Boosting & Discovery Metrics
  isSkauteHosted: boolean; // 💡 Ultimate priority placement flag
  isBoosted: boolean;
  boostExpiry?: Date;
  boostTier: "none" | "standard" | "premium";
  boostedBy?: mongoose.Types.ObjectId;
  priorityLevel: number;
  verifiedAt?: Date;
  featuredAt?: Date;

  isRecurring: boolean;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly" | "none";
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    parentId?: mongoose.Types.ObjectId;
  };

  joinLink?: string;
  meetingLink?: string;
  communityLink?: string;
  externalTicketLink?: string;

  attendees: number;
  views: number;
  likes: number;
  participantImages: string[];
  ageRestriction?: string;
  refundPolicy: "none" | "flexible" | "24h";
  tags: string[];
  isSoldOut: boolean;
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * REUSABLE DISCOVERY PRIORITIZATION UTILITY
 * Decoupled calculation logic to prevent desynchronization between save loops and API updates
 */
export const calculatePriorityScore = (event: {
  status: ("verified" | "featured")[];
  isBoosted: boolean;
  boostExpiry?: Date;
  isSkauteHosted?: boolean; // 💡 Embedded into calculation layer
}): number => {
  let score = 0;

  // 1. Structural validation tiers
  if (event.status?.includes("verified")) score += 1;
  if (event.status?.includes("featured")) score += 2;

  // 2. Commercial organic promotion tier
  const now = new Date();
  if (
    event.isBoosted &&
    event.boostExpiry &&
    new Date(event.boostExpiry) > now
  ) {
    score += 4;
  }

  // 3. Absolute ecosystem dominance layer (Skaute original/hosted items)
  if (event.isSkauteHosted) {
    score += 8;
  }

  return score;
};

const ticketTierSchema = new Schema<ITicketTier>({
  name: { type: String, required: true },
  price: { type: Number, default: 0, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  description: String,
  salesEnd: { type: Date },
  isSoldOut: { type: Boolean, default: false },
});

const coOrganizerSchema = new Schema<ICoOrganizer>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissions: {
      type: [String],
      enum: [
        "view_revenue",
        "issue_refunds",
        "send_broadcasts",
        "scan_tickets",
      ],
      default: ["scan_tickets"],
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Event slug is required for short URLs"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Please provide a description"],
    },
    eventFormat: {
      type: String,
      enum: ["physical", "online", "hybrid"],
      default: "physical",
    },
    isOnline: { type: Boolean, default: false },
    type: {
      type: String,
      enum: Object.keys(EVENT_TYPES),
      default: "activity",
    },
    status: {
      type: [String],
      enum: ["verified", "featured"],
      default: [],
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    category: {
      type: String,
      enum: Object.keys(EVENT_CATEGORIES),
      required: [true, "Please select a category"],
    },
    isPublic: { type: Boolean, default: true },
    allowAnonymous: { type: Boolean, default: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: function (this: IEvent) {
          return this.eventFormat !== "online";
        },
      },
      coordinates: {
        type: [Number],
        required: function (this: IEvent) {
          return this.eventFormat !== "online";
        },
      },
      address: String,
      neighborhood: String,
    },

    image: {
      type: String,
      default: "https://picsum.photos/seed/skaute/1200/800",
    },

    isFree: { type: Boolean, default: true },
    ticketingType: {
      type: String,
      enum: ["none", "internal", "external"],
      default: "none",
    },
    ticketTiers: [ticketTierSchema],
    discounts: [discountSchema],
    totalCapacity: { type: Number, default: null },

    // Boosting Infrastructure fields
    isSkauteHosted: { type: Boolean, default: false, index: true }, // 💡 Added database index targeting platform listings
    isBoosted: { type: Boolean, default: false, index: true },
    boostExpiry: { type: Date },
    boostTier: {
      type: String,
      enum: ["none", "standard", "premium"],
      default: "none",
    },
    boostedBy: { type: Schema.Types.ObjectId, ref: "User" },
    priorityLevel: { type: Number, default: 0, index: true },
    verifiedAt: { type: Date },
    featuredAt: { type: Date },

    isRecurring: { type: Boolean, default: false },
    recurrence: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "none"],
        default: "none",
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number }],
      endDate: { type: Date },
      parentId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    },

    joinLink: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    communityLink: { type: String, trim: true },
    externalTicketLink: { type: String, trim: true },
    attendees: { type: Number, default: 0 },
    views: { type: Number, default: 0, index: true },
    likes: { type: Number, default: 0, index: true },
    participantImages: [{ type: String }],
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coOrganizers: [coOrganizerSchema],
    organizerType: {
      type: String,
      enum: ["individual", "business"],
      default: "individual",
    },
    ageRestriction: { type: String, default: "All Ages" },
    refundPolicy: {
      type: String,
      enum: ["none", "flexible", "24h"],
      default: "none",
    },
    tags: [{ type: String }],
    isSoldOut: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCancelled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * PRE-SAVE HOOK
 */
eventSchema.pre<IEvent>("save", async function (this: IEvent) {
  // 1. Sync isOnline helper
  this.isOnline =
    this.eventFormat === "online" || this.eventFormat === "hybrid";

  // 2. Pricing and Capacity logic
  if (this.ticketingType === "internal" && this.ticketTiers?.length > 0) {
    this.totalCapacity = this.ticketTiers.reduce(
      (acc, tier) => acc + (tier.capacity || 0),
      0,
    );
    const hasPaidTier = this.ticketTiers.some((tier) => tier.price > 0);
    this.isFree = !hasPaidTier;
  } else if (this.ticketingType === "external") {
    this.isFree = false;
  } else {
    this.isFree = true;
  }

  // 3. Slug formatting
  if (this.slug) {
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
  }

  if (this.isNew) {
    this.views = 0;
    this.likes = 0;
    this.attendees = 0;
  }

  // 4. Update Priority Level using global decoupled scoring logic
  if (
    this.isModified("status") ||
    this.isModified("isBoosted") ||
    this.isModified("boostExpiry") ||
    this.isModified("isSkauteHosted") // 💡 Sync priority level if platform status shifts
  ) {
    this.priorityLevel = calculatePriorityScore({
      status: this.status,
      isBoosted: this.isBoosted,
      boostExpiry: this.boostExpiry,
      isSkauteHosted: this.isSkauteHosted,
    });
  }
});

/**
 * VIRTUALS
 */
eventSchema.virtual("shortUrl").get(function (this: IEvent) {
  return `/e/${this.slug}`;
});

eventSchema.virtual("priceLabel").get(function (this: IEvent) {
  if (
    this.ticketingType === "none" ||
    !this.ticketTiers ||
    this.ticketTiers.length === 0
  ) {
    return "Free";
  }
  const prices = this.ticketTiers.map((t) => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === 0) return "Free";
  if (min === 0 && max > 0) return "Free +";
  if (min === max) return `₦${min.toLocaleString()}`;
  return `From ₦${min.toLocaleString()}`;
});

eventSchema.virtual("startingPrice").get(function (this: IEvent) {
  if (this.isFree || !this.ticketTiers || this.ticketTiers.length === 0)
    return 0;
  return Math.min(...this.ticketTiers.map((tier) => tier.price));
});

/**
 * DATA INDEXES
 */
eventSchema.index({ location: "2dsphere" }, { sparse: true });
eventSchema.index({ "location.neighborhood": 1 }, { sparse: true });
eventSchema.index({ "recurrence.parentId": 1 });
eventSchema.index({ startDate: 1 });

// High-performance compound lookup index designed for lightning-fast localized discovery listings
eventSchema.index({
  approvalStatus: 1,
  isCancelled: 1,
  isSoldOut: 1,
  "location.neighborhood": 1,
  priorityLevel: -1,
  startDate: 1,
});

export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", eventSchema);
