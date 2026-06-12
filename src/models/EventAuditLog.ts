import mongoose, { Document, Schema } from "mongoose";

export type AuditSeverity = "info" | "warning" | "critical";

export interface IEventAuditLog extends Document {
  eventId: mongoose.Types.ObjectId;
  action: string;
  category: string;
  summary: string;
  severity: AuditSeverity;
  actor?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventAuditLogSchema = new Schema<IEventAuditLog>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    action: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
      index: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true },
);

EventAuditLogSchema.index({ eventId: 1, createdAt: -1 });

export const EventAuditLog =
  mongoose.models.EventAuditLog ||
  mongoose.model<IEventAuditLog>("EventAuditLog", EventAuditLogSchema);
