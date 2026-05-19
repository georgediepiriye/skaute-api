import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { USER_ROLES, UserRole } from "../lib/constants.js";

export type UserStatus = "active" | "suspended" | "pending";

export interface IUser extends Document {
  id: string;
  googleId?: string;
  name: string;
  email: string;
  image: string;
  password?: string;
  role: UserRole;
  interests: string[];
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
    address?: string;
    neighborhood?: string;
    city?: string;
  };
  status: UserStatus;
  active: boolean;
  correctPassword(
    candidatePassword: string,
    userPassword: string,
  ): Promise<boolean>;
}

// 2. Define the Schema
const userSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Please tell us your name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: function (this: IUser) {
        return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(this.name || "skaute")}`;
      },
    },
    password: {
      type: String,
      required: [
        function () {
          // If googleId is NOT present, password IS required.
          return !this.googleId;
        },
        "Please provide a password",
      ],
      minlength: 5,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    interests: [{ type: String }],

    location: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        default: [7.0085, 4.8156], // Default to Port Harcourt [long, lat]
      },
      address: String,
      neighborhood: String,
      city: { type: String, default: "Port Harcourt" },
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "active",
    },

    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * INDEXES
 * This is crucial for performance and geo-queries
 */
userSchema.index({ location: "2dsphere" });

/**
 * PASSWORD HASHING MIDDLEWARE
 */
userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.pre<IUser>("save", function (next) {
  if (this.isModified("status")) {
    this.active = this.status === "active";
  }
});

userSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
