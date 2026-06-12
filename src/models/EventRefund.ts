import mongoose, { Document, Schema } from "mongoose";

export type EventRefundStatus =
  | "requested"
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "processed"
  | "failed";

export interface IEventRefund extends Document {
  eventId: mongoose.Types.ObjectId;
  ticket: mongoose.Types.ObjectId;
  ticketCode: string;
  checkInCode: string;
  guestName: string;
  email: string;
  amount: number;
  status: EventRefundStatus;
  ticketStatus: string;
  reason?: string;
  requestedBy?: mongoose.Types.ObjectId;
  decidedBy?: mongoose.Types.ObjectId;
  decisionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventRefundSchema = new Schema<IEventRefund>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    ticket: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    ticketCode: { type: String, required: true, index: true },
    checkInCode: { type: String, required: true },
    guestName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "requested",
        "pending",
        "approved",
        "rejected",
        "processing",
        "processed",
        "failed",
      ],
      default: "requested",
      index: true,
    },
    ticketStatus: { type: String, required: true },
    reason: String,
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decisionReason: String,
  },
  { timestamps: true },
);

EventRefundSchema.index({ eventId: 1, status: 1, createdAt: -1 });

export const EventRefund =
  mongoose.models.EventRefund ||
  mongoose.model<IEventRefund>("EventRefund", EventRefundSchema);
