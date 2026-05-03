import mongoose, { Schema, Document } from "mongoose";
import crypto from "node:crypto";
import { TICKET_STATUS, TicketStatus } from "../lib/constants.js";

export interface ITicket extends Document {
  event: mongoose.Types.ObjectId;
  owner?: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  tierName: string;
  pricePaid: number;
  buyerInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
  ticketCode: string;
  checkInCode: string;
  status: TicketStatus;
  checkedInAt?: Date;
  checkedInBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: false },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    tierName: { type: String, required: true },
    pricePaid: { type: Number, required: true },
    buyerInfo: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },
    ticketCode: { type: String, required: true, unique: true },
    checkInCode: { type: String, unique: true, required: true },

    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: "valid",
    },
    checkedInAt: { type: Date },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

ticketSchema.pre("validate", async function (this: ITicket) {
  if (!this.checkInCode) {
    this.checkInCode = `KIVO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }
  if (!this.ticketCode) {
    this.ticketCode = `REF-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

// Enhanced Indexes for the  Scanner
ticketSchema.index({ checkInCode: 1 });
ticketSchema.index({ event: 1, checkInCode: 1 });
ticketSchema.index({ event: 1, status: 1 });
ticketSchema.index({ owner: 1 });
ticketSchema.index({ "buyerInfo.email": 1 });
ticketSchema.index({ event: 1, updatedAt: 1 });

export const Ticket =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", ticketSchema);
