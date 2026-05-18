/* eslint-disable no-console */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Hotspot from "../models/Hotspot.js";
import { HOTSPOT_CATEGORIES } from "../lib/constants.js";

dotenv.config();

const hotspots = [
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
    title: "Scaute Hub",
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

const seedDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is missing in .env");

    await mongoose.connect(uri);
    console.log("🔌 Connected to scaute DB...");

    await Hotspot.deleteMany({});
    console.log("🗑️ Cleared existing hotspots.");

    const formattedHotspots = hotspots.map((h, index) => ({
      title: h.title,
      category: h.category, // Matches your HOTSPOT_CATEGORIES slugs exactly
      status: h.status || "CHILL",
      description: `Discover the best of Port Harcourt at ${h.title}. A top-rated ${h.category} destination in ${h.neighborhood} curated for the scaute community.`,

      // Main Cover Image
      image: `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80`,

      // Gallery - Limited to 5 images per your requirement
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

    process.exit();
  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

seedDB();
