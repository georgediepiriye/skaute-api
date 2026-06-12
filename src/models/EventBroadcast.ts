import mongoose, { Document, Schema } from "mongoose";

export type BroadcastAudience = "all" | "valid" | "checked-in" | "not-checked-in";
export type BroadcastStatus = "queued" | "sending" | "sent" | "failed";

export interface IEventBroadcast extends Document {
  eventId: mongoose.Types.ObjectId;
  channel: "email";
  audience: BroadcastAudience;
  subject: string;
  message: string;
  sentBy: mongoose.Types.ObjectId;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: BroadcastStatus;
  sentAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventBroadcastSchema = new Schema<IEventBroadcast>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    channel: { type: String, enum: ["email"], default: "email" },
    audience: {
      type: String,
      enum: ["all", "valid", "checked-in", "not-checked-in"],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed"],
      default: "queued",
      index: true,
    },
    sentAt: Date,
    failureReason: String,
  },
  { timestamps: true },
);

EventBroadcastSchema.index({ eventId: 1, createdAt: -1 });

export const EventBroadcast =
  mongoose.models.EventBroadcast ||
  mongoose.model<IEventBroadcast>("EventBroadcast", EventBroadcastSchema);
