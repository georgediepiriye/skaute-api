import mongoose, { Schema, Document } from "mongoose";
import { ORDER_STATUS, OrderStatus } from "../lib/constants.js";

export interface IOrder extends Document {
  user?: mongoose.Types.ObjectId;
  buyerEmail: string;
  event: mongoose.Types.ObjectId;
  tierName: string;
  quantity: number;
  totalAmount: number;
  status: OrderStatus;
  paymentReference: string;
  paymentUrl: string;
  expiresAt: Date;
  paymentMethod: "paystack" | "cash" | "transfer" | "pos" | "complimentary";
  issuedBy?: mongoose.Types.ObjectId;
}

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    buyerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    tierName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    paymentReference: { type: String, unique: true, required: true },
    paymentUrl: { type: String },
    expiresAt: { type: Date },
    paymentMethod: {
      type: String,
      enum: ["paystack", "cash", "transfer", "pos", "complimentary"],
      default: "paystack",
      required: true,
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ event: 1, paymentMethod: 1 });

export const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
