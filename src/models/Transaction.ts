// models/Transaction.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  user: mongoose.Types.ObjectId;
  event?: mongoose.Types.ObjectId;
  type: "ticket_sale" | "gate_sale" | "refund" | "payout" | "ticket_transfer";
  amount: number;
  fee: number; // Skaute's 5.5% commission
  netAmount: number; // For gate sales, this will be calculated as a negative debt (-fee)
  status: "pending" | "success" | "failed";
  reference: string;
  metadata?: any;
}

const transactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: false },
    event: { type: Schema.Types.ObjectId, ref: "Event" },
    type: {
      type: String,
      enum: ["ticket_sale", "gate_sale", "refund", "payout", "ticket_transfer"],
      required: true,
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    reference: { type: String, required: true, unique: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Transaction =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", transactionSchema);
