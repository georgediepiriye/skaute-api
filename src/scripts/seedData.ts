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
  {
    title: "Casablanca Sports Bar",
    category: HOTSPOT_CATEGORIES.nightlife?.slug || "nightlife",
    status: "HOT",
    neighborhood: "GRA Phase 3",
    coords: [6.978, 4.811],
  },
  {
    title: "Asia Town",
    category: HOTSPOT_CATEGORIES.lounge?.slug || "lounge",
    status: "TRENDING",
    neighborhood: "Old GRA",
    coords: [7.011, 4.782],
  },
  {
    title: "Sky Bar PH",
    category: HOTSPOT_CATEGORIES.lounge?.slug || "lounge", // Shifted to lounge to align with rooftop profile
    status: "TRENDING",
    neighborhood: "Genesis",
    coords: [7.002, 4.835],
  },
  {
    title: "Bole King",
    category: HOTSPOT_CATEGORIES.localEats?.slug || "localeats",
    status: "HOT",
    neighborhood: "Garrison",
    coords: [6.9925, 4.8142],
  },
  {
    title: "Native Tray",
    category: HOTSPOT_CATEGORIES.localEats?.slug || "localeats",
    status: "ACTIVE",
    neighborhood: "GRA",
    coords: [6.982, 4.819],
  },
  {
    title: "Vintage Cafe",
    category: HOTSPOT_CATEGORIES.dining?.slug || "dining", // Consolidated under new Fine Dining & Cafes category
    status: "CHILL",
    neighborhood: "GRA Phase 2",
    coords: [6.975, 4.815],
  },
  {
    title: "Skaute Hub",
    category: HOTSPOT_CATEGORIES.workspace?.slug || "workspace",
    status: "ACTIVE",
    neighborhood: "Trans Amadi",
    coords: [7.032, 4.825],
  },
  {
    title: "Rivers State Museum",
    category: HOTSPOT_CATEGORIES.lifestyle?.slug || "lifestyle", // Mapped into Culture & Malls
    status: "CHILL",
    neighborhood: "Secretariat",
    coords: [7.008, 4.785],
  },
  {
    title: "PH Pleasure Park",
    category: HOTSPOT_CATEGORIES.parks?.slug || "parks", // Mapped into Parks & Nature
    status: "TRENDING",
    neighborhood: "Rumuola",
    coords: [7.0094, 4.8239],
  },
  {
    title: "Port Harcourt Mall",
    category: HOTSPOT_CATEGORIES.lifestyle?.slug || "lifestyle", // Mapped into Culture & Malls
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
    console.log("🛡️ Ensuring database integrity...");

    // Get list of indexes
    const indexes = await Hotspot.collection.listIndexes().toArray();
    const hasTTLIndex = indexes.some(
      (idx) => idx.name === "vibeCheck.votes.createdAt_1",
    );

    if (hasTTLIndex) {
      await Hotspot.collection.dropIndex("vibeCheck.votes.createdAt_1");
      console.log("✅ Successfully dropped legacy TTL index.");
    } else {
      console.log("ℹ️ No legacy TTL index found. Proceeding safely.");
    }
    console.log("📡 Connected to database instance.");

    console.log("🧹 Cleaning transient ephemeral database collections...");
    if (mongoose.connection.collections["events"]) await Event.deleteMany({});
    if (mongoose.connection.collections["users"]) await User.deleteMany({});

    // Note: Hotspot collection deletion completely removed here to shield real locations from loss.
    console.log("🗑️ Cleared existing transient Events and Users.");

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
        interests: ["music"],
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
    const categoryKeys = Object.keys(EVENT_CATEGORIES || {});
    const typeKeys = Object.keys(EVENT_TYPES || {});

    console.log("🎲 Generating 100 high-quality events...");

    const eventBatch = Array.from({ length: 100 }).map((_, i) => {
      const host = faker.helpers.arrayElement(createdUsers);

      const isVerified = Math.random() > 0.7;
      const isFeatured = Math.random() > 0.85;
      const isBoosted = Math.random() > 0.9;
      const isSoldOut = Math.random() > 0.55;
      const isSkauteHosted = Math.random() > 0.93;
      const isCancelled = false;

      const status: ("verified" | "featured")[] = [];
      if (isVerified) status.push("verified");
      if (isFeatured) status.push("featured");

      const boostExpiry = isBoosted ? faker.date.soon({ days: 7 }) : undefined;

      let priorityLevel = 0;
      if (typeof calculatePriorityScore === "function") {
        priorityLevel = calculatePriorityScore({
          status,
          isBoosted,
          boostExpiry,
          isSkauteHosted,
          isCancelled,
        });
      }

      const formatRoll = Math.random();
      let eventFormat =
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
        category:
          categoryKeys.length > 0
            ? faker.helpers.arrayElement(categoryKeys)
            : "nightlife",
        type:
          typeKeys.length > 0
            ? faker.helpers.arrayElement(typeKeys)
            : "activity",
        status,
        approvalStatus: "approved",
        priorityLevel,
        isBoosted,
        isSoldOut,
        isCancelled,
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
        eventFormat,
        isOnline,
        startDate,
        endDate,
        createdAt,
        image: faker.helpers.arrayElement(SKAUTE_EVENT_IMAGES),
        organizer: host._id,
        coOrganizers: [],
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
        ticketTiers: [],
        discounts: [],
        isFree: true,
        ticketingType: "none",
        ticketsSold: faker.number.int({ min: 0, max: attendees }),
        totalCapacity: null,
        isRecurring: false,
        recurrence: {
          frequency: "none",
          interval: 1,
          daysOfWeek: [],
        },
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
            description:
              faker.commerce.productAdjective() + " access tier pass.",
            salesEnd: faker.date.soon({ days: 2, refDate: startDate }),
            isSoldOut: isNaturallyFull,
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
    console.log(
      "✅ Successfully seeded 100 high-quality schema-validated events.",
    );

    // ==========================================
    // 3. SEED HOTSPOTS (Production-Safe Check)
    // ==========================================
    console.log("📍 Processing Location Matrix...");

    for (const h of hotspotsData) {
      // Check if the venue exists by title to protect manual entries
      const existingHotspot = await Hotspot.findOne({ title: h.title });

      if (existingHotspot) {
        console.log(
          `⏩ [Skipped] "${h.title}" already exists in the database.`,
        );
        continue;
      }

      const voteCount = faker.number.int({ min: 5, max: 25 });
      const assignedVotes: any[] = [];
      const counts = { lit: 0, lively: 0, chill: 0, dull: 0 };

      for (let k = 0; k < voteCount; k++) {
        const chosenVibe = faker.helpers.arrayElement([
          "LIT",
          "LIVELY",
          "CHILL",
          "DULL",
        ]);

        assignedVotes.push({
          userId: faker.helpers.arrayElement(createdUsers)._id,
          vibe: chosenVibe,
          createdAt: new Date(), // Keep baseline data high in freshness calculations
        });

        if (chosenVibe === "LIT") counts.lit++;
        if (chosenVibe === "LIVELY") counts.lively++;
        if (chosenVibe === "CHILL") counts.chill++;
        if (chosenVibe === "DULL") counts.dull++;
      }

      let topVibe = "UNKNOWN";
      let maxVotes = 0;
      Object.entries(counts).forEach(([key, val]) => {
        if (val > maxVotes) {
          maxVotes = val;
          topVibe = key.toUpperCase();
        }
      });

      const rawFeatures = [
        "Cocktails",
        "Rooftop",
        "Parking",
        "Good Music",
        "Fast Wi-Fi",
        "Air Conditioning",
      ];
      const chosenFeatures = faker.helpers.arrayElements(rawFeatures, {
        min: 2,
        max: 4,
      });

      const now = new Date();

      await Hotspot.create({
        title: h.title,
        description: `Discover the best of Port Harcourt at ${h.title}. A top-rated destination in ${h.neighborhood} curated for the Skaute community.`,
        category: h.category,
        status: h.status || "CHILL",
        image: `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80`,
        gallery: [
          `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=60`,
          `https://images.unsplash.com/photo-1574097656146-0b43b7660cb6?w=400&q=60`,
        ],
        location: {
          type: "Point",
          coordinates: h.coords,
          address: `${h.neighborhood}, Port Harcourt, Rivers State`,
          neighborhood: h.neighborhood,
          city: "Port Harcourt",
          state: "Rivers State",
        },
        vibeCheck: {
          votes: assignedVotes,
          currentVibe: maxVotes > 0 ? topVibe : "CHILL",
          totalVotes: voteCount,
          counts,
          lastUpdated: now,
        },
        lastVibeActivityAt: now,
        decayAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        energyRadius: 25,
        energyLevel: 0,
        activities: {
          hasKaraoke: faker.datatype.boolean(),
          hasLiveBand:
            h.category === "nightlife" || h.category === "lounge"
              ? faker.datatype.boolean()
              : false,
          hasSnooker: faker.datatype.boolean(),
          hasPoolside: faker.datatype.boolean(),
          hasShisha:
            h.category === "nightlife" || h.category === "lounge"
              ? faker.datatype.boolean()
              : false,
          hasVIPLounge: faker.datatype.boolean(),
          hasOutdoorSeating: faker.datatype.boolean(),
          hasArcadeGames: false,
        },
        features: chosenFeatures,
        isVerified: true,
        isClaimed: false,
        claimedBy: null,
        priceTier: faker.helpers.arrayElement(["₦", "₦₦", "₦₦₦", "₦₦₦₦"]),
        contact: {
          phone: "+234" + faker.string.numeric(10),
          instagram: `@${h.title.toLowerCase().replace(/[^a-z0-9]/g, "")}_ph`,
          website: faker.internet.url(),
        },
        openingHours: [
          { day: "Mon", open: "12:00", close: "00:00", isClosed: false },
          { day: "Tue", open: "12:00", close: "00:00", isClosed: false },
          { day: "Wed", open: "12:00", close: "00:00", isClosed: false },
          { day: "Thu", open: "12:00", close: "02:00", isClosed: false },
          { day: "Fri", open: "14:00", close: "04:00", isClosed: false },
          { day: "Sat", open: "14:00", close: "04:00", isClosed: false },
          { day: "Sun", open: "14:00", close: "01:00", isClosed: false },
        ],
        analytics: {
          viewCount: faker.number.int({ min: 120, max: 2500 }),
          savedCount: faker.number.int({ min: 10, max: 430 }),
        },
        bestTimeToVisit:
          h.category === "nightlife" || h.category === "lounge"
            ? "9:00 PM - 2:00 AM"
            : "4:00 PM - 8:00 PM",
        isActive: true,
      });

      console.log(`🌱 [Seeded] New baseline venue added: ${h.title}`);
    }

    console.log("✅ Hotspots syncing complete without tracking losses.");
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
