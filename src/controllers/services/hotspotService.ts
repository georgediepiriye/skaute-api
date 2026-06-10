import Hotspot from "../../models/Hotspot.js";
import { getIO } from "../../socket.js";
import AppError from "../../utils/AppError.js";
import httpStatus from "http-status";

export const getAllHotspots = async (query: any) => {
  const queryObj = { ...query };
  const excludedFields = [
    "page",
    "sort",
    "limit",
    "fields",
    "search",
    "activity",
    "neighborhood",
  ];
  excludedFields.forEach((el) => delete queryObj[el]);

  // 1. BASE FILTER CONFIGURATION
  // Use $ne: false to capture both documents set to true AND documents missing the field completely
  let filter: any = {
    ...queryObj,
    isActive: { $ne: false },
  };

  // 2. ADVANCED MAP FILTERS
  // Full-text search across Title, Neighborhood & Features
  if (query.search) {
    filter.$text = { $search: query.search };
  }

  // Activity filter maps directly to embedded booleans
  if (query.activity) {
    filter[`activities.${query.activity}`] = true;
  }

  if (query.neighborhood) {
    filter["location.neighborhood"] = {
      $regex: query.neighborhood,
      $options: "i",
    };
  }

  // 💡 FLEXIBLE GEOGRAPHIC LOCK (Fixes empty payload array)
  // Matches "Rivers", "Rivers State", "rivers state" flexibly using case-insensitive Regex
  filter["location.state"] = {
    $regex: "^Rivers",
    $options: "i",
  };

  let dbQuery = Hotspot.find(filter);

  // 3. SORTING
  if (query.sort) {
    const sortBy = query.sort.split(",").join(" ");
    dbQuery = dbQuery.sort(sortBy);
  } else {
    dbQuery = dbQuery.sort("-status -analytics.viewCount");
  }

  // 4. PAGINATION
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  dbQuery = dbQuery.skip(skip).limit(limit);

  // 5. EXECUTE
  const hotspots = await dbQuery;
  const total = await Hotspot.countDocuments(filter);

  return { hotspots, total, page, limit };
};

export const getHotspotById = async (id: string) => {
  // Finds hotspot and chains populate to pull future tickets/moves linked to this venue space
  return await Hotspot.findById(id);
};

export const createHotspot = async (data: any) => {
  return await Hotspot.create(data);
};

export const updateHotspot = async (hotspotId: string, data: any) => {
  const updatedHotspot = await Hotspot.findByIdAndUpdate(hotspotId, data, {
    new: true,
    runValidators: true,
  });

  if (!updatedHotspot) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot not found");
  }

  return updatedHotspot;
};

export const deleteHotspot = async (hotspotId: string) => {
  const deletedHotspot = await Hotspot.findByIdAndDelete(hotspotId);

  if (!deletedHotspot) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot not found");
  }
};

export const toggleHotspotActive = async (
  hotspotId: string,
  isActive: boolean,
) => {
  const hotspot = await Hotspot.findById(hotspotId);

  if (!hotspot) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot not found");
  }

  hotspot.isActive = isActive;
  await hotspot.save();

  return hotspot;
};

export const castVibe = async (
  hotspotId: string,
  userId: string,
  vibeStr: "LIT" | "LIVELY" | "CHILL" | "DULL",
) => {
  const hotspot = await Hotspot.findById(hotspotId);
  if (!hotspot) throw new Error("Hotspot not found");

  // 1. Calculate Time Relevance Weight
  const hour = new Date().getHours();
  let timeWeight = 1.0;

  if (hotspot.category === "nightlife" && (hour < 18 || hour > 5)) {
    timeWeight = 0.2;
  } else if (hotspot.category === "localeats" && (hour < 8 || hour > 21)) {
    timeWeight = 0.2;
  }

  // 2. Add vote with weight (Replace previous vote by this user)
  const incomingUserIdStr = userId.toString();
  const remainingVotes = hotspot.vibeCheck.votes.filter(
    (v: any) => v.userId && v.userId.toString() !== incomingUserIdStr,
  );

  hotspot.vibeCheck.votes = remainingVotes as any;
  hotspot.vibeCheck.votes.push({
    userId: incomingUserIdStr,
    vibe: vibeStr,
    createdAt: new Date(),
    weight: timeWeight,
  });

  // 3. IMMEDIATE RECOUNT (No threshold required)
  const counts = { lit: 0, lively: 0, chill: 0, dull: 0 };

  hotspot.vibeCheck.votes.forEach((v: any) => {
    const w = v.weight || 1;
    if (v.vibe === "LIT") counts.lit += w;
    if (v.vibe === "LIVELY") counts.lively += w;
    if (v.vibe === "CHILL") counts.chill += w;
    if (v.vibe === "DULL") counts.dull += w;
  });

  hotspot.vibeCheck.counts = counts;

  // Set Top Vibe based on weighted counts (Updates on every vote)
  const entries = Object.entries(counts) as [string, number][];
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  hotspot.vibeCheck.currentVibe = top[0].toUpperCase() as any;

  hotspot.vibeCheck.totalVotes = hotspot.vibeCheck.votes.length;
  hotspot.lastVibeActivityAt = new Date();

  hotspot.markModified("vibeCheck");
  await hotspot.save();

  const hotspotData = hotspot.toObject({ virtuals: true });

  // 4. BROADCAST UPDATE
  getIO().to(`hotspot:${hotspotId}`).emit("hotspot-vibe-updated", {
    hotspotId,
    vibeCheck: hotspotData.vibeCheck,
    energyScore: hotspotData.energyScore,
    vibeScore: hotspotData.vibeScore,
    heatIntensity: hotspotData.heatIntensity,
    vibeFreshness: hotspotData.vibeFreshness,
    computedAuraRadius: hotspotData.computedAuraRadius,
  });

  return hotspotData;
};
