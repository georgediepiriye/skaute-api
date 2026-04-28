import mongoose, { Schema, Document } from "mongoose";
import {
  EventCategory,
  KivoType,
  EVENT_TYPES,
  EVENT_CATEGORIES,
} from "../lib/constants.js";

interface ITicketTier {
  name: string;
  price: number;
  capacity: number;
  sold: number;
  description?: string;
}

export interface IEvent extends Document {
  title: string;
  description: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  type: KivoType;
  status: "casual" | "verified" | "featured";

  // Format Logic
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
  coOrganizers: mongoose.Types.ObjectId[];
  organizerType: "individual" | "business";

  // Pricing & Tickets
  isFree: boolean;
  ticketingType: "none" | "internal" | "external";
  ticketTiers: ITicketTier[];
  totalCapacity?: number;

  // Recurrence Logic
  isRecurring: boolean;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly" | "none";
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    parentId?: mongoose.Types.ObjectId;
  };

  // Links & CTA
  joinLink?: string;
  meetingLink?: string;
  externalTicketLink?: string;

  attendees: number;
  participantImages: string[];
  ageRestriction?: string;
  refundPolicy: "none" | "flexible" | "24h";
  tags: string[];
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ticketTierSchema = new Schema<ITicketTier>({
  name: { type: String, required: true },
  price: { type: Number, default: 0, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  description: String,
});

const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
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
      type: String,
      enum: ["casual", "verified", "featured"],
      default: "casual",
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
      default: "https://picsum.photos/seed/kivo/1200/800",
    },

    // Ticketing
    isFree: { type: Boolean, default: true },
    ticketingType: {
      type: String,
      enum: ["none", "internal", "external"],
      default: "none",
    },
    ticketTiers: [ticketTierSchema],
    totalCapacity: { type: Number, default: null },

    // Recurrence
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

    // Metadata & Engagement
    joinLink: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    externalTicketLink: { type: String, trim: true },
    attendees: { type: Number, default: 0 },
    participantImages: [{ type: String }],
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coOrganizers: [{ type: Schema.Types.ObjectId, ref: "User" }],
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
 * Using async function to automatically handle middleware flow without next()
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
});

/**
 * VIRTUALS
 */

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

eventSchema.virtual("ticketsSold").get(function (this: IEvent) {
  return this.attendees || 0;
});

/**
 * INDEXES
 */
eventSchema.index({ location: "2dsphere" }, { sparse: true });
eventSchema.index({ "location.neighborhood": 1 }, { sparse: true });
eventSchema.index({ "recurrence.parentId": 1 });
eventSchema.index({ startDate: 1 });

export const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", eventSchema);
