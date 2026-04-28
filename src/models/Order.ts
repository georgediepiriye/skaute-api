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
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true },
);

export const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
