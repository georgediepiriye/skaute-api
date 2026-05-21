import mongoose, { Document, Schema } from "mongoose";

export interface IPayout extends Document {
  organizer: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  amount: number;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  status: "pending" | "processing" | "completed" | "failed";
  paymentReference?: string;
  requestedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100,
    },
    bankDetails: {
      bankName: { type: String, required: true },
      accountNumber: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 10,
      },
      accountName: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export const Payout =
  mongoose.models.Payout || mongoose.model<IPayout>("Payout", PayoutSchema);
