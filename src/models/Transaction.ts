import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  wallet: mongoose.Types.ObjectId;
  type: "ticket_sale" | "withdrawal" | "refund" | "payout";
  amount: number;
  fee: number; // scaute's service fee
  status: "pending" | "success" | "failed";
  reference: string; // Paystack reference or internal ID
  metadata?: any;
}

const transactionSchema = new Schema<ITransaction>(
  {
    wallet: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    type: {
      type: String,
      enum: ["ticket_sale", "withdrawal", "refund", "payout"],
      required: true,
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
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
