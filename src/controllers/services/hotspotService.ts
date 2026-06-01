import Hotspot from "../../models/Hotspot.js";

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

  let filter: any = { ...queryObj, isActive: true };

  // 1. ADVANCED MAP FILTERS
  // Full-text search across Title, Neighborhood & Features
  if (query.search) {
    filter.$text = { $search: query.search };
  }

  // Activity filter maps directly to embedded booleans (e.g., activity=hasKaraoke -> activities.hasKaraoke: true)
  if (query.activity) {
    filter[`activities.${query.activity}`] = true;
  }

  if (query.neighborhood) {
    filter["location.neighborhood"] = {
      $regex: query.neighborhood,
      $options: "i",
    };
  }

  // Ensure baseline geography focus is locked to launch region
  filter["location.state"] = "Rivers State";

  let dbQuery = Hotspot.find(filter);

  // 2. SORTING (Fallback changed from rating to dynamic visibility metric indicators)
  if (query.sort) {
    const sortBy = query.sort.split(",").join(" ");
    dbQuery = dbQuery.sort(sortBy);
  } else {
    dbQuery = dbQuery.sort("-status -analytics.viewCount");
  }

  // 3. PAGINATION
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  dbQuery = dbQuery.skip(skip).limit(limit);

  // 4. EXECUTE
  const hotspots = await dbQuery;
  const total = await Hotspot.countDocuments(filter);

  return { hotspots, total, page, limit };
};

export const getHotspotById = async (id: string) => {
  // Finds hotspot and chains populate to pull future tickets/moves linked to this venue space
  return await Hotspot.findById(id).populate("upcomingMoves");
};

export const createHotspot = async (data: any) => {
  return await Hotspot.create(data);
};

export const castVibe = async (
  hotspotId: string,
  userId: string,
  vibeStr: string,
) => {
  const hotspot = await Hotspot.findById(hotspotId);
  if (!hotspot) throw new Error("Hotspot not found");

  // Filter out any active vote this specific user already has floating inside the array matrix
  hotspot.vibeCheck.votes = hotspot.vibeCheck.votes.filter(
    (v: any) => v.userId.toString() !== userId.toString(),
  );

  // Inject fresh real-time vote metric
  hotspot.vibeCheck.votes.push({ userId, vibe: vibeStr });

  // Compute highest occurring frequency value
  const voteCounts: Record<string, number> = {
    LIT: 0,
    LIVELY: 0,
    CHILL: 0,
    DULL: 0,
  };
  hotspot.vibeCheck.votes.forEach((v: any) => {
    voteCounts[v.vibe]++;
  });

  let topVibe = "UNKNOWN";
  let maxVotes = 0;

  Object.entries(voteCounts).forEach(([key, value]) => {
    if (value > maxVotes) {
      maxVotes = value;
      topVibe = key;
    }
  });

  hotspot.vibeCheck.currentVibe = maxVotes > 0 ? topVibe : "CHILL";
  hotspot.vibeCheck.lastUpdated = new Date();

  await hotspot.save();
  return hotspot;
};
