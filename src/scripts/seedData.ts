/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { EVENT_CATEGORIES, EVENT_TYPES } from "../lib/constants.js";

dotenv.config();

// Strictly use these images for all events
const KIVO_EVENT_IMAGES = [
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778009848/kivo_events/bqsjv88hteupsshuufo0.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778009787/kivo_events/ewwcfo3qgng6jik4oc5a.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778009554/kivo_events/hbvtzkbh1nqqnmng8urj.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778009477/kivo_events/obgza7vnnzmrloiblhik.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778009383/kivo_events/qp1fimleenmolleflqnd.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778008943/kivo_events/arr9ygu9greezvh6ioyf.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778008865/kivo_events/yyjgytd7iyedhguj6kvk.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778008782/kivo_events/pidezcbw5qeqdv5336ri.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778008622/kivo_events/qyecl6qiagljvn956ljp.jpg",
  "https://res.cloudinary.com/dzhfiblg7/image/upload/v1778008218/kivo_events/gxb9ftdgp6qrnxsvc0bq.jpg",
];

const PH_NEIGHBORHOODS = [
  "Old GRA",
  "GRA Phase 2",
  "Choba",
  "Woji",
  "Rumuola",
  "D-Line",
  "Peter Odili",
  "Trans Amadi",
  "Ada George",
  "Rumuokoro",
];

// Port Harcourt geographical bounds
const PH_BOUNDS = { latMin: 4.75, latMax: 4.9, lngMin: 6.95, lngMax: 7.1 };

const TIER_TEMPLATES = [
  ["Regular", "VIP", "VVIP"],
  ["Early Bird", "Standard"],
  ["Single Entry", "Couple's Pass", "Group of 5"],
  ["Student", "Professional", "Executive"],
  ["General Admission", "Backstage Access"],
];

async function seedDatabase() {
  try {
    const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
    if (!uri) throw new Error("Database connection string missing in .env");
    await mongoose.connect(uri);

    console.log("🧹 Cleaning database...");
    await Event.deleteMany({});
    await User.deleteMany({});

    // --- 1. SEED USERS ---
    console.log("👤 Seeding users...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const userBatch = [
      {
        name: "Kivo Admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin",
        image: faker.image.avatar(),
      },
      ...Array.from({ length: 19 }).map(() => ({
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: hashedPassword,
        role: faker.helpers.arrayElement(["user", "organizer"]),
        image: faker.image.avatar(),
      })),
    ];

    const createdUsers = await User.insertMany(userBatch);
    console.log(`✅ Created ${createdUsers.length} users.`);

    // --- 2. SEED EVENTS ---
    const categoryKeys = Object.keys(EVENT_CATEGORIES);
    const typeKeys = Object.keys(EVENT_TYPES);

    console.log("🎲 Generating 100 high-quality events...");

    const eventBatch = Array.from({ length: 100 }).map((_, i) => {
      const host = faker.helpers.arrayElement(createdUsers);

      const formatRoll = Math.random();
      let eventFormat: "physical" | "hybrid" | "online";
      if (formatRoll < 0.75) eventFormat = "physical";
      else if (formatRoll < 0.9) eventFormat = "hybrid";
      else eventFormat = "online";

      const isOnline = eventFormat === "online" || eventFormat === "hybrid";
      const hasPhysicalPresence =
        eventFormat === "physical" || eventFormat === "hybrid";

      const now = new Date();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      let startDate: Date;
      let endDate: Date;

      if (Math.random() < 0.3) {
        startDate = new Date(now.getTime() - ONE_DAY);
        endDate = new Date(now.getTime() + 3 * ONE_DAY);
      } else {
        startDate = faker.date.soon({
          days: 30,
          refDate: new Date(now.getTime() + 2 * ONE_DAY),
        });
        endDate = new Date(
          startDate.getTime() + faker.number.int({ min: 1, max: 4 }) * ONE_DAY,
        );
      }

      const eventData: Record<string, any> = {
        title: `${faker.commerce.productAdjective()} ${faker.helpers.arrayElement(["Summit", "Party", "Festival", "Workshop", "Hangout"])}`,
        description: faker.commerce.productDescription(),
        category: faker.helpers.arrayElement(categoryKeys),
        type: faker.helpers.arrayElement(typeKeys),
        status: faker.helpers.arrayElement(["casual", "verified", "featured"]),
        // UPDATE: Added approvalStatus for Admin Dashboard Moderation
        // 70% chance of being approved, 30% pending for your queue testing
        approvalStatus: Math.random() > 0.3 ? "approved" : "pending",
        medium: eventFormat,
        eventFormat,
        isOnline,
        startDate,
        endDate,
        image: faker.helpers.arrayElement(KIVO_EVENT_IMAGES),
        organizer: host._id,
        organizerType: host.role === "organizer" ? "business" : "individual",
        isPublic: true,
        allowAnonymous: faker.datatype.boolean(),
        attendees: faker.number.int({ min: 15, max: 250 }),
        participantImages: Array.from({ length: 5 }).map(() =>
          faker.image.avatar(),
        ),
        ageRestriction: faker.helpers.arrayElement(["All Ages", "18+", "21+"]),
        refundPolicy: faker.helpers.arrayElement(["none", "flexible", "24h"]),
        tags: faker.helpers.arrayElements(
          ["live music", "networking", "party", "tech", "web3"],
          3,
        ),
        isCancelled: false,
        ticketTiers: [],
        isFree: true,
      };

      // Ticketing Logic
      const ticketingType = faker.helpers.arrayElement([
        "none",
        "internal",
        "external",
      ]);
      eventData.ticketingType = ticketingType;

      if (ticketingType === "internal") {
        eventData.isFree = Math.random() > 0.2;
        if (!eventData.isFree) {
          const template = faker.helpers.arrayElement(TIER_TEMPLATES);
          const basePrice = faker.number.int({ min: 2500, max: 10000 });
          eventData.ticketTiers = template.map((name, idx) => ({
            name,
            price: basePrice * (idx + 1),
            capacity: 100,
            sold: faker.number.int({ min: 0, max: 15 }),
          }));
        }
      } else if (ticketingType === "external") {
        eventData.isFree = false;
        eventData.externalTicketLink = faker.internet.url();
      }

      // Location Logic - Focused on Port Harcourt
      if (hasPhysicalPresence) {
        eventData.location = {
          type: "Point",
          coordinates: [
            faker.location.longitude({
              min: PH_BOUNDS.lngMin,
              max: PH_BOUNDS.lngMax,
            }),
            faker.location.latitude({
              min: PH_BOUNDS.latMin,
              max: PH_BOUNDS.latMax,
            }),
          ],
          address: faker.location.streetAddress(),
          neighborhood: PH_NEIGHBORHOODS[i % 10],
        };
      }

      if (isOnline) {
        eventData.meetingLink = faker.internet.url();
      }

      return eventData;
    });

    await Event.insertMany(eventBatch);

    console.log("🚀 Kivo Database Fully Seeded!");
    console.log("----------------------------------");
    console.log(`Admin Login: admin@gmail.com / password123`);
    console.log(`Events: 100 (Randomized Pending/Approved status)`);
    console.log(`Location: Centered in Port Harcourt, Rivers State`);
    console.log("----------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();
