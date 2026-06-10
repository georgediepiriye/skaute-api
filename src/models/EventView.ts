import mongoose, { Document, Schema } from "mongoose";

export interface IEventView extends Document {
  event: mongoose.Types.ObjectId;
  viewerKey: string;
  viewedOn: string;
  user?: mongoose.Types.ObjectId;
  ip?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const eventViewSchema = new Schema<IEventView>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    viewerKey: {
      type: String,
      required: true,
    },
    viewedOn: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    ip: String,
    deviceFingerprint: String,
    userAgent: String,
  },
  { timestamps: true },
);

eventViewSchema.index({ event: 1, viewerKey: 1, viewedOn: 1 }, { unique: true });
eventViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

const EventView =
  mongoose.models.EventView ||
  mongoose.model<IEventView>("EventView", eventViewSchema);

export default EventView;
