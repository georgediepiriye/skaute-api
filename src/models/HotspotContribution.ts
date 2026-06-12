import mongoose, { Document, Schema } from "mongoose";

export type HotspotContributionType =
  | "photo"
  | "pin"
  | "hours"
  | "contact"
  | "description"
  | "closed"
  | "duplicate";

export interface IHotspotContribution extends Document {
  hotspot: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId | null;
  type: HotspotContributionType;
  payload: {
    value?: string;
    note?: string;
    imageUrl?: string;
    coordinates?: [number, number];
    metadata?: Record<string, unknown>;
  };
  status: "pending" | "approved" | "rejected";
  submittedBy: {
    userId?: mongoose.Types.ObjectId | null;
    email?: string | null;
    name?: string | null;
    ip?: string | null;
  };
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hotspotContributionSchema = new Schema<IHotspotContribution>(
  {
    hotspot: {
      type: Schema.Types.ObjectId,
      ref: "Hotspot",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "photo",
        "pin",
        "hours",
        "contact",
        "description",
        "closed",
        "duplicate",
      ],
      required: true,
      index: true,
    },
    payload: {
      value: String,
      note: String,
      imageUrl: String,
      coordinates: {
        type: [Number],
        validate: {
          validator: (val?: number[]) => !val || val.length === 2,
          message: "Coordinates must be [longitude, latitude]",
        },
      },
      metadata: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    submittedBy: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      email: { type: String, default: null },
      name: { type: String, default: null },
      ip: { type: String, default: null },
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    adminNote: String,
  },
  { timestamps: true },
);

hotspotContributionSchema.index({ hotspot: 1, status: 1, createdAt: -1 });
hotspotContributionSchema.index({ status: 1, createdAt: -1 });
hotspotContributionSchema.index({
  "submittedBy.ip": 1,
  hotspot: 1,
  type: 1,
  createdAt: -1,
});

const HotspotContribution =
  mongoose.models.HotspotContribution ||
  mongoose.model<IHotspotContribution>(
    "HotspotContribution",
    hotspotContributionSchema,
  );

export default HotspotContribution;
