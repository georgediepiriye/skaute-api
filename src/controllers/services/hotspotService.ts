import Hotspot from "../../models/Hotspot.js";
import { getIO } from "../../socket.js";

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

export const castVibe = async (
  hotspotId: string,
  userId: string,
  vibeStr: "LIT" | "LIVELY" | "CHILL" | "DULL",
) => {
  const hotspot = await Hotspot.findById(hotspotId);

  if (!hotspot) {
    throw new Error("Hotspot not found");
  }

  // 1. Safe Filter: Remove user's previous vote (handling potential ObjectId conversion safely)
  const incomingUserIdStr = userId.toString();
  const remainingVotes = hotspot.vibeCheck.votes.filter(
    (v) => v.userId && v.userId.toString() !== incomingUserIdStr,
  );

  // 2. Re-assign and add latest vote
  hotspot.vibeCheck.votes = remainingVotes as any;
  hotspot.vibeCheck.votes.push({
    userId: incomingUserIdStr,
    vibe: vibeStr,
    createdAt: new Date(),
  });

  // 3. Count votes cleanly
  const voteCounts = { LIT: 0, LIVELY: 0, CHILL: 0, DULL: 0 };

  hotspot.vibeCheck.votes.forEach((vote) => {
    if (voteCounts[vote.vibe] !== undefined) {
      voteCounts[vote.vibe]++;
    }
  });

  hotspot.vibeCheck.counts = {
    lit: voteCounts.LIT,
    lively: voteCounts.LIVELY,
    chill: voteCounts.CHILL,
    dull: voteCounts.DULL,
  };

  hotspot.vibeCheck.totalVotes = hotspot.vibeCheck.votes.length;

  // 4. Determine current top vibe with a clean priority tie-breaker (LIT > LIVELY > CHILL > DULL)
  // Using >= ensures that if two vibes are tied, the one appearing later in this array wins
  // (or change to > if you want earlier keys to win)
  const vibePriority: ("LIT" | "LIVELY" | "CHILL" | "DULL")[] = [
    "DULL",
    "CHILL",
    "LIVELY",
    "LIT",
  ];
  let topVibe: "LIT" | "LIVELY" | "CHILL" | "DULL" = "CHILL";
  let maxVotes = 0;

  vibePriority.forEach((vibe) => {
    const count = voteCounts[vibe];
    if (count >= maxVotes && count > 0) {
      maxVotes = count;
      topVibe = vibe;
    }
  });

  hotspot.vibeCheck.currentVibe = topVibe;

  // 5. Update timestamps and decay properties
  const now = new Date();
  hotspot.vibeCheck.lastUpdated = now;
  hotspot.lastVibeActivityAt = now;
  hotspot.decayAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours lifecycle

  // CRITICAL: Force Mongoose to acknowledge the deep nested array modification
  hotspot.markModified("vibeCheck.votes");
  hotspot.markModified("vibeCheck.counts");

  await hotspot.save();

  // 6. Refresh virtuals
  const hotspotData = hotspot.toObject({
    virtuals: true,
  });

  // 7. BROADCAST LIVE UPDATE TO ROOM
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
