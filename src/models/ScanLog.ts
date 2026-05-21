import mongoose, { Document, Schema } from "mongoose";
import { SCAN_LOG_STATUS, ScanLogStatus } from "../lib/constants.js";

export interface IScanLog extends Document {
  event: mongoose.Types.ObjectId;
  ticket: mongoose.Types.ObjectId;
  scanner: mongoose.Types.ObjectId; // The user profile (staff/bouncer) validating the ticket
  status: ScanLogStatus;
  deviceFingerprint?: string; // Captures unique phone identifiers to spot bad staff devices
  scannedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScanLogSchema = new Schema<IScanLog>(
  {
    event: {
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
    scanner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SCAN_LOG_STATUS),
      required: true,
      index: true, // Used to immediately filter out anomalies/fraud lines for the alerts feed
    },
    deviceFingerprint: {
      type: String,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true, // Used for time-series charts showing peak entry velocity hours
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to help generate real-time performance analytics very quickly
ScanLogSchema.index({ event: 1, status: 1, scannedAt: -1 });

export const ScanLog =
  mongoose.models.ScanLog || mongoose.model<IScanLog>("ScanLog", ScanLogSchema);
