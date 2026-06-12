import mongoose, { Document, Schema } from "mongoose";

export interface IHotspotSuggestion extends Document {
  title: string;
  category: string;
  location: {
    address?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    coordinates?: [number, number];
  };
  contact?: {
    phone?: string;
    website?: string;
    instagram?: string;
  };
  note?: string;
  image?: {
    url: string;
    publicId: string;
    resourceType?: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    uploadedAt: Date;
  };
  suggestedBy?: {
    name?: string;
    email?: string;
    userId?: mongoose.Types.ObjectId | string;
  };
  status: "pending" | "approved" | "rejected";
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId | string;
  reviewedAt?: Date;
  createdHotspotId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hotspotSuggestionSchema = new Schema<IHotspotSuggestion>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    location: {
      address: String,
      neighborhood: String,
      city: { type: String, default: "Port Harcourt" },
      state: { type: String, default: "Rivers State" },
      coordinates: {
        type: [Number],
        validate: {
          validator: (val?: number[]) => !val || val.length === 0 || val.length === 2,
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },
    contact: {
      phone: String,
      website: String,
      instagram: String,
    },
    note: String,
    image: {
      url: String,
      publicId: String,
      resourceType: String,
      format: String,
      bytes: Number,
      width: Number,
      height: Number,
      uploadedAt: Date,
    },
    suggestedBy: {
      name: String,
      email: String,
      userId: { type: Schema.Types.ObjectId, ref: "User" },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    adminNotes: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    createdHotspotId: { type: Schema.Types.ObjectId, ref: "Hotspot" },
  },
  { timestamps: true },
);

hotspotSuggestionSchema.index({
  title: "text",
  "location.address": "text",
  "location.neighborhood": "text",
  "location.city": "text",
  "suggestedBy.name": "text",
  "suggestedBy.email": "text",
});

const HotspotSuggestion =
  mongoose.models.HotspotSuggestion ||
  mongoose.model<IHotspotSuggestion>(
    "HotspotSuggestion",
    hotspotSuggestionSchema,
  );

export default HotspotSuggestion;
