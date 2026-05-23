import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  user: mongoose.Types.ObjectId; // Buyer (for ticket_sale/refund) OR Host (for payout)
  event?: mongoose.Types.ObjectId; // Optional: context for ticket sales or payouts
  type: "ticket_sale" | "refund" | "payout";
  amount: number; // Total gross amount processed
  fee: number; // Skaute's platform commission split
  netAmount: number; // Amount after fees (gross - fee)
  status: "pending" | "success" | "failed";
  reference: string; // Paystack payment ref or  manual transfer bank reference
  metadata?: any; // Save bank names, account numbers, or raw webhook payloads
}

const transactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: false }, // Not required to allow guest checkouts (null for guests)
    event: { type: Schema.Types.ObjectId, ref: "Event" },
    type: {
      type: String,
      enum: ["ticket_sale", "refund", "payout"],
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
