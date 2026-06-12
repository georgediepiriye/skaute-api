import mongoose, { Document, Schema } from "mongoose";

export interface IScannerDevice extends Document {
  eventId: mongoose.Types.ObjectId;
  deviceId: string;
  label: string;
  operator?: mongoose.Types.ObjectId;
  operatorName?: string;
  lastSeen?: Date;
  scanCount: number;
  status: "active" | "revoked" | "offline";
  revokedBy?: mongoose.Types.ObjectId;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScannerDeviceSchema = new Schema<IScannerDevice>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true, trim: true },
    label: { type: String, default: "Scanner" },
    operator: { type: Schema.Types.ObjectId, ref: "User" },
    operatorName: String,
    lastSeen: Date,
    scanCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "revoked", "offline"],
      default: "active",
      index: true,
    },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revokedAt: Date,
  },
  { timestamps: true },
);

ScannerDeviceSchema.index({ eventId: 1, deviceId: 1 }, { unique: true });

export const ScannerDevice =
  mongoose.models.ScannerDevice ||
  mongoose.model<IScannerDevice>("ScannerDevice", ScannerDeviceSchema);
