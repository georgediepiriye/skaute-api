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

/**
 * MAIN EVENT INTERFACE (UPDATED)
 */
export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  type: skauteType;
  status: ("verified" | "featured")[];

  // ✅ APPROVAL SYSTEM (ENHANCED)
  approvalStatus: "pending" | "approved" | "rejected";
  approvalReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  ticketsSold: number;
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

  isSkauteHosted: boolean;
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
 * PRIORITY SCORE ENGINE
 */
export const calculatePriorityScore = (event: {
  status: ("verified" | "featured")[];
  isBoosted: boolean;
  boostExpiry?: Date;
  isSkauteHosted?: boolean;
  isCancelled?: boolean; // Add this
}): number => {
  // If the move is cancelled, completely strip its search ranking priority
  if (event.isCancelled) return -10;

  let score = 0;
  if (event.status?.includes("verified")) score += 1;
  if (event.status?.includes("featured")) score += 2;

  const now = new Date();
  if (event.isBoosted && event.boostExpiry && event.boostExpiry > now) {
    score += 4;
  }
  if (event.isSkauteHosted) {
    score += 8;
  }

  return score;
};

/**
 * SCHEMAS
 */
const ticketTierSchema = new Schema<ITicketTier>({
  name: { type: String, required: true },
  price: { type: Number, default: 0, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  description: String,
  salesEnd: Date,
  isSoldOut: { type: Boolean, default: false },
});

const coOrganizerSchema = new Schema<ICoOrganizer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * EVENT SCHEMA
 */
const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
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

    // ✅ APPROVAL SCHEMA (UPDATED)
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    approvalReason: String,

    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,

    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date,

    category: {
      type: String,
      enum: Object.keys(EVENT_CATEGORIES),
      required: true,
    },

    isPublic: { type: Boolean, default: true },
    allowAnonymous: { type: Boolean, default: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: function () {
          return this.eventFormat !== "online";
        },
      },
      coordinates: {
        type: [Number],
        required: function () {
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
    ticketsSold: { type: Number, default: 0 },

    ticketTiers: [ticketTierSchema],
    discounts: [discountSchema],
    totalCapacity: { type: Number, default: null },

    isSkauteHosted: { type: Boolean, default: false, index: true },
    isBoosted: { type: Boolean, default: false, index: true },
    boostExpiry: Date,

    boostTier: {
      type: String,
      enum: ["none", "standard", "premium"],
      default: "none",
    },

    boostedBy: { type: Schema.Types.ObjectId, ref: "User" },

    priorityLevel: { type: Number, default: 0, index: true },

    verifiedAt: Date,
    featuredAt: Date,

    isRecurring: { type: Boolean, default: false },

    recurrence: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "none"],
        default: "none",
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [Number],
      endDate: Date,
      parentId: { type: Schema.Types.ObjectId, ref: "Event" },
    },

    joinLink: String,
    meetingLink: String,
    communityLink: String,
    externalTicketLink: String,

    attendees: { type: Number, default: 0 },
    views: { type: Number, default: 0, index: true },
    likes: { type: Number, default: 0, index: true },

    participantImages: [String],

    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

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

    tags: [String],

    isSoldOut: { type: Boolean, default: false, index: true },
    isCancelled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

eventSchema.index({ location: "2dsphere" });
/**
 * PRE-SAVE HOOK
 */
eventSchema.pre<IEvent>("save", function () {
  this.isOnline =
    this.eventFormat === "online" || this.eventFormat === "hybrid";

  if (
    this.isModified("status") ||
    this.isModified("isBoosted") ||
    this.isModified("isCancelled") ||
    this.isModified("isSkauteHosted")
  ) {
    this.priorityLevel = calculatePriorityScore({
      status: this.status,
      isBoosted: this.isBoosted,
      boostExpiry: this.boostExpiry,
      isSkauteHosted: this.isSkauteHosted,
      isCancelled: this.isCancelled, // Pass it along
    });
  }
});

/**
 * VIRTUALS
 */
eventSchema.virtual("shortUrl").get(function () {
  return `/e/${this.slug}`;
});

/**
 * EXPORT
 */
export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", eventSchema);
