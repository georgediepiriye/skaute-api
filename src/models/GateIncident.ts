import mongoose, { Document, Schema } from "mongoose";

export type GateIncidentResolution = "allowed" | "denied" | "reviewed";

export interface IGateIncident extends Document {
  eventId: mongoose.Types.ObjectId;
  ticket?: mongoose.Types.ObjectId;
  type: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  metadata?: Record<string, any>;
  status: "open" | "resolved";
  resolution?: GateIncidentResolution;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GateIncidentSchema = new Schema<IGateIncident>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket" },
    type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning",
      index: true,
    },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
      index: true,
    },
    resolution: { type: String, enum: ["allowed", "denied", "reviewed"] },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: true },
);

GateIncidentSchema.index({ eventId: 1, status: 1, createdAt: -1 });

export const GateIncident =
  mongoose.models.GateIncident ||
  mongoose.model<IGateIncident>("GateIncident", GateIncidentSchema);
