/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Event, calculatePriorityScore } from "../models/Event.js";
import Hotspot from "../models/Hotspot.js";
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  HOTSPOT_CATEGORIES,
} from "../lib/constants.js";

dotenv.config();

const SKAUTE_EVENT_IMAGES = [
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

const PH_BOUNDS = { latMin: 4.75, latMax: 4.9, lngMin: 6.95, lngMax: 7.1 };

const TIER_TEMPLATES = [
  ["Regular", "VIP", "VVIP"],
  ["Early Bird", "Standard"],
  ["Single Entry", "Couple's Pass", "Group of 5"],
  ["Student", "Professional", "Executive"],
  ["General Admission", "Backstage Access"],
];

const hotspotsData = [
  // --- NIGHTLIFE & LOUNGE (High Energy) ---
  {
    title: "Casablanca Sports Bar",
    category: HOTSPOT_CATEGORIES.nightlife.slug,
    status: "HOT",
    neighborhood: "GRA Phase 3",
    coords: [6.978, 4.811],
  },
  {
    title: "Asia Town",
    category: HOTSPOT_CATEGORIES.lounge.slug,
    status: "TRENDING",
    neighborhood: "Old GRA",
    coords: [7.011, 4.782],
  },
  {
    title: "Sky Bar PH",
    category: HOTSPOT_CATEGORIES.nightlife.slug,
    status: "TRENDING",
    neighborhood: "Genesis",
    coords: [7.002, 4.835],
  },

  // --- DINING & CAFE (Culinary) ---
  {
    title: "Bole King",
    category: HOTSPOT_CATEGORIES.dining.slug,
    status: "HOT",
    neighborhood: "Garrison",
    coords: [6.9925, 4.8142],
  },
  {
    title: "Native Tray",
    category: HOTSPOT_CATEGORIES.dining.slug,
    status: "ACTIVE",
    neighborhood: "GRA",
    coords: [6.982, 4.819],
  },
  {
    title: "Vintage Cafe",
    category: HOTSPOT_CATEGORIES.cafe.slug,
    status: "CHILL",
    neighborhood: "GRA Phase 2",
    coords: [6.975, 4.815],
  },

  // --- WORKSPACE & ARTS (Productivity & Culture) ---
  {
    title: "Skaute Hub",
    category: HOTSPOT_CATEGORIES.workspace.slug,
    status: "ACTIVE",
    neighborhood: "Trans Amadi",
    coords: [7.032, 4.825],
  },
  {
    title: "Rivers State Museum",
    category: HOTSPOT_CATEGORIES.arts.slug,
    status: "CHILL",
    neighborhood: "Secretariat",
    coords: [7.008, 4.785],
  },

  // --- WELLNESS & RETAIL (Active & Outdoors) ---
  {
    title: "PH Pleasure Park",
    category: HOTSPOT_CATEGORIES.wellness.slug,
    status: "TRENDING",
    neighborhood: "Rumuola",
    coords: [7.0094, 4.8239],
  },
  {
    title: "Port Harcourt Mall",
    category: HOTSPOT_CATEGORIES.retail.slug,
    status: "ACTIVE",
    neighborhood: "Azikiwe",
    coords: [7.005, 4.7797],
  },
];

async function seedDatabase() {
  try {
    const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
    if (!uri) throw new Error("Database connection string missing in .env");
    await mongoose.connect(uri);

    console.log("🧹 Cleaning database collections...");
    await Event.deleteMany({});
    await User.deleteMany({});
    await Hotspot.deleteMany({});
    console.log("🗑️ Cleared existing Events, Users, and Hotspots.");

    // ==========================================
    // 1. SEED USERS
    // ==========================================
    console.log("👤 Seeding users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    const userBatch = [
      {
        name: "Skaute Admin",
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

    // ==========================================
    // 2. SEED EVENTS
    // ==========================================
    const categoryKeys = Object.keys(EVENT_CATEGORIES);
    const typeKeys = Object.keys(EVENT_TYPES);

    console.log(
      "🎲 Generating 100 high-quality events with Platform Overrides...",
    );

    const eventBatch = Array.from({ length: 100 }).map((_, i) => {
      const host = faker.helpers.arrayElement(createdUsers);

      const isVerified = Math.random() > 0.7;
      const isFeatured = Math.random() > 0.85;
      const isBoosted = Math.random() > 0.9;
      const isSoldOut = Math.random() > 0.85;
      const isSkauteHosted = Math.random() > 0.93;

      const status: ("verified" | "featured")[] = [];
      if (isVerified) status.push("verified");
      if (isFeatured) status.push("featured");

      const boostExpiry = isBoosted ? faker.date.soon({ days: 7 }) : undefined;

      const priorityLevel = calculatePriorityScore({
        status,
        isBoosted,
        boostExpiry,
        isSkauteHosted,
      });

      const formatRoll = Math.random();
      let eventFormat: "physical" | "hybrid" | "online" =
        formatRoll < 0.75 ? "physical" : formatRoll < 0.9 ? "hybrid" : "online";

      const isOnline = eventFormat === "online" || eventFormat === "hybrid";
      const hasPhysicalPresence =
        eventFormat === "physical" || eventFormat === "hybrid";
      const now = new Date();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      const createdAt =
        Math.random() > 0.8
          ? faker.date.recent({ days: 1 })
          : faker.date.past({ years: 0.1 });

      let startDate, endDate;
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

      const attendees = faker.number.int({
        min: isFeatured || isSkauteHosted ? 50 : 5,
        max: isFeatured || isSkauteHosted ? 500 : 150,
      });

      const eventData: any = {
        title: isSkauteHosted
          ? `Skaute Official: ${faker.commerce.productAdjective()} Hangout`
          : `${faker.commerce.productAdjective()} ${faker.helpers.arrayElement(["Summit", "Party", "Festival", "Workshop", "Hangout"])}`,
        slug: faker.helpers.slugify(
          `${faker.commerce.productAdjective()}-${i}-${Date.now()}`,
        ),
        description: faker.commerce.productDescription(),
        category: faker.helpers.arrayElement(categoryKeys),
        type: faker.helpers.arrayElement(typeKeys),
        status,
        priorityLevel,
        isBoosted,
        isSoldOut,
        boostExpiry,

        isSkauteHosted,
        boostTier: isBoosted
          ? faker.helpers.arrayElement(["standard", "premium"])
          : "none",
        boostedBy: isBoosted ? host._id : undefined,
        verifiedAt: isVerified
          ? faker.date.past({ years: 0.05, refDate: startDate })
          : undefined,
        featuredAt: isFeatured
          ? faker.date.past({ years: 0.05, refDate: startDate })
          : undefined,

        approvalStatus: "approved",
        eventFormat,
        isOnline,
        startDate,
        endDate,
        createdAt,
        image: faker.helpers.arrayElement(SKAUTE_EVENT_IMAGES),
        organizer: host._id,
        organizerType: host.role === "organizer" ? "business" : "individual",
        isPublic: true,
        allowAnonymous: faker.datatype.boolean(),
        attendees,
        views: faker.number.int({ min: attendees * 2, max: attendees * 10 }),
        likes: faker.number.int({
          min: Math.floor(attendees / 4),
          max: attendees,
        }),
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

      const ticketingType = faker.helpers.arrayElement([
        "none",
        "internal",
        "external",
      ]);
      eventData.ticketingType = ticketingType;

      if (ticketingType === "internal") {
        eventData.isFree = Math.random() > 0.4;
        const template = faker.helpers.arrayElement(TIER_TEMPLATES);
        const basePrice = eventData.isFree
          ? 0
          : faker.number.int({ min: 2500, max: 10000 });

        eventData.ticketTiers = template.map((name, idx) => {
          const capacity = faker.number.int({ min: 50, max: 200 });

          const isNaturallyFull = Math.random() > 0.9;
          const sold = isNaturallyFull
            ? capacity
            : Math.floor(attendees / template.length);

          return {
            name,
            price: basePrice * (idx + 1),
            capacity,
            sold,
            salesEnd: faker.date.soon({ days: 2, refDate: startDate }),
          };
        });
      } else if (ticketingType === "external") {
        eventData.isFree = false;
        eventData.externalTicketLink = faker.internet.url();
      }

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

      if (isOnline) eventData.meetingLink = faker.internet.url();
      return eventData;
    });

    await Event.insertMany(eventBatch);
    console.log("✅ Successfully seeded 100 high-quality events.");

    // ==========================================
    // 3. SEED HOTSPOTS
    // ==========================================
    console.log("📍 Seeding Hotspots...");
    const formattedHotspots = hotspotsData.map((h, index) => ({
      title: h.title,
      category: h.category,
      status: h.status || "CHILL",
      description: `Discover the best of Port Harcourt at ${h.title}. A top-rated ${h.category} destination in ${h.neighborhood} curated for the skaute community.`,
      image: `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80`,
      gallery: [
        `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=60&sig=${index}1`,
        `https://images.unsplash.com/photo-1574097656146-0b43b7660cb6?w=400&q=60&sig=${index}2`,
        `https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=60&sig=${index}3`,
        `https://images.unsplash.com/photo-1559333086-b0a56225a93c?w=400&q=60&sig=${index}4`,
        `https://images.unsplash.com/photo-1514525253344-9914f255399c?w=400&q=60&sig=${index}5`,
      ],
      location: {
        type: "Point",
        coordinates: h.coords,
        address: `${h.neighborhood}, Port Harcourt, Rivers State`,
        neighborhood: h.neighborhood,
        city: "Port Harcourt",
        state: "Rivers State",
      },
      rating: parseFloat((Math.random() * (5 - 4.3) + 4.3).toFixed(1)),
      bestTimeToVisit:
        h.category === "nightlife" || h.category === "lounge"
          ? "8:00 PM - Late"
          : "10:00 AM - 7:00 PM",
      isActive: true,
    }));

    await Hotspot.insertMany(formattedHotspots);
    console.log(
      `✅ Successfully seeded ${formattedHotspots.length} hotspots using exact constants!`,
    );

    console.log("\n----------------------------------");
    console.log("🚀 Skaute Database Fully Seeded with Events & Hotspots!");
    console.log("----------------------------------");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();
