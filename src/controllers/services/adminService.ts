import mongoose from "mongoose";
import crypto from "node:crypto";
import httpStatus from "http-status";
import axios from "axios";
import {
  ORDER_STATUS,
  SCAN_LOG_STATUS,
  TICKET_STATUS,
} from "../../lib/constants.js";
import { Event } from "../../models/Event.js";
import Hotspot from "../../models/Hotspot.js";
import HotspotContribution from "../../models/HotspotContribution.js";
import HotspotSuggestion from "../../models/HotspotSuggestion.js";
import { Order } from "../../models/Order.js";
import { Payout } from "../../models/Payout.js";
import { ScanLog } from "../../models/ScanLog.js";
import { Ticket } from "../../models/Ticket.js";
import { Transaction } from "../../models/Transaction.js";
import { User } from "../../models/User.js";
import skauteEvents from "../../utils/eventsEmitter.js";
import config from "../../config/config.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const getModerationQueue = async (query: any) => {
  // 1. FILTERING
  const queryObj = { ...query };
  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  const filter = { ...queryObj };
  if (!filter.approvalStatus) filter.approvalStatus = "pending";

  if (filter.title) filter.title = { $regex: filter.title, $options: "i" };
  if (filter.neighborhood)
    filter["location.neighborhood"] = filter.neighborhood;

  // 2. DATA FETCHING (CURRENT VIEW)
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  let dbQuery = Event.find(filter)
    .populate("organizer", "name image email")
    .sort(query.sort ? query.sort.split(",").join(" ") : "-createdAt")
    .skip(skip)
    .limit(limit);

  // 3. EXECUTE PARALLEL QUERIES
  // We fetch the current page of events AND all status counts simultaneously
  const [
    events,
    totalEvents,
    pendingCount,
    approvedCount,
    rejectedCount,
    grandTotal,
  ] = await Promise.all([
    dbQuery,
    Event.countDocuments(filter), // Total for the current filtered view
    Event.countDocuments({ approvalStatus: "pending" }),
    Event.countDocuments({ approvalStatus: "approved" }),
    Event.countDocuments({ approvalStatus: "rejected" }),
    Event.countDocuments({}), // Grand total of all events
  ]);

  return {
    events,
    pagination: {
      totalEvents, // Total for the current filter (used for pagination)
      totalPages: Math.ceil(totalEvents / limit),
      page,
      limit,
      // Metadata for your dashboard stat cards
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        all: grandTotal,
      },
    },
  };
};

export const getEventForPreview = async (id: string) => {
  const event = await Event.findById(id).populate("organizer");
  return event;
};

export const getHotspotsList = async (query: any) => {
  const queryObj = { ...query };
  const excludedFields = [
    "page",
    "sort",
    "limit",
    "fields",
    "search",
    "neighborhood",
    "source",
    "importStatus",
    "mapboxId",
    "osmId",
    "externalProvider",
    "externalPlaceId",
    "importBatchId",
  ];
  excludedFields.forEach((el) => delete queryObj[el]);

  const filter: any = { ...queryObj };

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  if (query.neighborhood) {
    filter["location.neighborhood"] = {
      $regex: query.neighborhood,
      $options: "i",
    };
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  }
  if (query.isVerified !== undefined) {
    filter.isVerified = query.isVerified === "true";
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;
  const sortBy = query.sort ? query.sort.split(",").join(" ") : "-createdAt";

  const [hotspots, totalHotspots, activeCount, inactiveCount] =
    await Promise.all([
      Hotspot.find(filter).sort(sortBy).skip(skip).limit(limit),
      Hotspot.countDocuments(filter),
      Hotspot.countDocuments({ isActive: { $ne: false } }),
      Hotspot.countDocuments({ isActive: false }),
    ]);

  return {
    hotspots,
    pagination: {
      total: totalHotspots,
      totalHotspots,
      pages: Math.ceil(totalHotspots / limit),
      totalPages: Math.ceil(totalHotspots / limit),
      page,
      limit,
      counts: {
        active: activeCount,
        inactive: inactiveCount,
        all: activeCount + inactiveCount,
      },
    },
  };
};

const normalizeHotspotCategory = (category: string) =>
  category === "others" ? "other" : category;

export const getHotspotSuggestions = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;
  const filter: any = {};

  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: "i" } },
      { "location.address": { $regex: query.search, $options: "i" } },
      { "location.neighborhood": { $regex: query.search, $options: "i" } },
      { "location.city": { $regex: query.search, $options: "i" } },
      { "suggestedBy.name": { $regex: query.search, $options: "i" } },
      { "suggestedBy.email": { $regex: query.search, $options: "i" } },
    ];
  }

  const [suggestions, total] = await Promise.all([
    HotspotSuggestion.find(filter).sort("-createdAt").skip(skip).limit(limit),
    HotspotSuggestion.countDocuments(filter),
  ]);

  return {
    suggestions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getHotspotSuggestionById = async (id: string) => {
  const suggestion = await HotspotSuggestion.findById(id);
  if (!suggestion) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot suggestion not found");
  }
  return suggestion;
};

export const updateHotspotSuggestion = async (id: string, data: any) => {
  if (data.category) data.category = normalizeHotspotCategory(data.category);

  const suggestion = await HotspotSuggestion.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!suggestion) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot suggestion not found");
  }

  return suggestion;
};

export const approveHotspotSuggestion = async (
  id: string,
  adminId: string,
) => {
  const suggestion = await HotspotSuggestion.findById(id);
  if (!suggestion) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot suggestion not found");
  }

  if (suggestion.status === "approved" && suggestion.createdHotspotId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This suggestion has already been approved.",
    );
  }

  if (
    !suggestion.location?.address &&
    !suggestion.location?.neighborhood &&
    !suggestion.location?.coordinates
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Suggestion needs an address, neighborhood, or coordinates before approval.",
    );
  }

  const hotspot = await Hotspot.create({
    title: suggestion.title,
    description:
      suggestion.note ||
      "Suggested by the Skaute community. Details pending admin review.",
    category: normalizeHotspotCategory(suggestion.category),
    status: "CHILL",
    image:
      suggestion.image?.url ||
      "https://picsum.photos/seed/skaute-hotspot/1200/800",
    gallery: suggestion.image?.url ? [suggestion.image.url] : [],
    location: {
      type: "Point",
      coordinates: suggestion.location?.coordinates || [7.0134, 4.8156],
      address: suggestion.location?.address || "",
      neighborhood: suggestion.location?.neighborhood || "",
      city: suggestion.location?.city || "Port Harcourt",
      state: suggestion.location?.state || "Rivers State",
    },
    activities: {
      hasKaraoke: false,
      hasLiveBand: false,
      hasSnooker: false,
      hasPoolside: false,
      hasShisha: false,
      hasVIPLounge: false,
      hasOutdoorSeating: false,
      hasArcadeGames: false,
    },
    features: [],
    priceTier: "₦₦",
    contact: suggestion.contact || {},
    openingHours: [],
    bestTimeToVisit: "To be confirmed",
    energyRadius: 25,
    isVerified: false,
    isActive: false,
  });

  suggestion.status = "approved";
  suggestion.reviewedBy = new mongoose.Types.ObjectId(adminId);
  suggestion.reviewedAt = new Date();
  suggestion.createdHotspotId = hotspot._id;
  await suggestion.save();

  return { hotspot, suggestion };
};

export const rejectHotspotSuggestion = async (
  id: string,
  adminId: string,
  adminNotes?: string,
) => {
  const suggestion = await HotspotSuggestion.findById(id);
  if (!suggestion) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot suggestion not found");
  }

  suggestion.status = "rejected";
  suggestion.reviewedBy = new mongoose.Types.ObjectId(adminId);
  suggestion.reviewedAt = new Date();
  suggestion.adminNotes = adminNotes;
  await suggestion.save();

  return suggestion;
};

export const deleteHotspotSuggestion = async (id: string) => {
  const suggestion = await HotspotSuggestion.findByIdAndDelete(id);
  if (!suggestion) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot suggestion not found");
  }

  if (suggestion.image?.publicId) {
    await cloudinary.uploader.destroy(suggestion.image.publicId);
  }

  return true;
};

type MapboxHotspotCandidate = {
  source?: "mapbox";
  sourceId: string;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  coordinates: [number, number];
  sourceCategories?: string[];
  category?: string;
  distanceMeters?: number;
  confidence?: number;
};

type OsmHotspotCandidate = {
  source: "osm";
  sourceId: string;
  osmId: string;
  osmType: "node" | "way" | "relation";
  name: string;
  category: string;
  address: string;
  neighborhood?: string;
  coordinates: [number, number];
  alreadyExists?: boolean;
  existingHotspotId?: string | null;
  confidence?: number;
};

const PH_AREAS: Record<string, { lng: number; lat: number }> = {
  "Port Harcourt": { lng: 7.0134, lat: 4.8156 },
  GRA: { lng: 7.0007, lat: 4.8276 },
  "Old GRA": { lng: 7.0143, lat: 4.7898 },
  "Trans Amadi": { lng: 7.0451, lat: 4.8231 },
  Woji: { lng: 7.0528, lat: 4.8492 },
  "Peter Odili": { lng: 7.0559, lat: 4.7906 },
  "Ada George": { lng: 6.9735, lat: 4.8461 },
  Rumuola: { lng: 7.0008, lat: 4.8357 },
  "D-Line": { lng: 7.0061, lat: 4.8124 },
  Abuloma: { lng: 7.0738, lat: 4.7786 },
};

const mapMapboxCategoryToHotspotCategory = (category: string) => {
  const normalized = category.toLowerCase();

  if (["bar", "nightclub"].includes(normalized)) return "nightlife";
  if (["restaurant", "food_and_drink"].includes(normalized)) return "localeats";
  if (normalized === "cafe") return "lifestyle";
  if (normalized === "hotel") return "lifestyle";

  return "other";
};

const normalizeCandidateName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const osmPreviewCache = new Map<
  string,
  { expiresAt: number; candidates: OsmHotspotCandidate[] }
>();

const calculateDistanceMeters = (
  from: { lng: number; lat: number },
  to: [number, number],
) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to[1] - from.lat);
  const dLng = toRadians(to[0] - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
};

const toMapboxCandidate = (
  feature: any,
  category: string,
  areaCenter: { lng: number; lat: number },
) => {
  const coordinates =
    feature.geometry?.coordinates ||
    feature.coordinates ||
    feature.properties?.coordinates;
  const properties = feature.properties || {};
  const context = properties.context || {};
  const sourceId = properties.mapbox_id || feature.id;
  const name =
    properties.name ||
    properties.name_preferred ||
    feature.text ||
    feature.place_name;

  if (!sourceId || !name || !Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const sourceCategories = [
    ...(Array.isArray(properties.poi_category)
      ? properties.poi_category
      : [properties.poi_category]),
    ...(Array.isArray(properties.category)
      ? properties.category
      : [properties.category]),
  ].filter(Boolean);

  return {
    source: "mapbox" as const,
    sourceId,
    name,
    address:
      properties.full_address ||
      properties.place_formatted ||
      properties.address ||
      feature.place_name ||
      "",
    neighborhood:
      context.neighborhood?.name ||
      properties.neighborhood ||
      context.place?.name,
    city: context.place?.name || "Port Harcourt",
    state: context.region?.name || "Rivers State",
    coordinates: [Number(coordinates[0]), Number(coordinates[1])] as [
      number,
      number,
    ],
    sourceCategories,
    category,
    distanceMeters: calculateDistanceMeters(areaCenter, [
      Number(coordinates[0]),
      Number(coordinates[1]),
    ]),
    confidence: properties.match_code?.confidence || properties.score,
  };
};

const findDuplicateHotspot = async (candidate: MapboxHotspotCandidate) => {
  const [lng, lat] = candidate.coordinates;
  const normalizedName = normalizeCandidateName(candidate.name);
  const normalizedAddress = normalizeCandidateName(candidate.address || "");
  const sourceConditions: any[] = [
    { source: "mapbox", sourceId: candidate.sourceId },
    { mapboxId: candidate.sourceId },
  ];

  if ((candidate as any).source === "osm") {
    sourceConditions.push({ source: "osm", sourceId: candidate.sourceId });
    if ((candidate as any).osmId) {
      sourceConditions.push({ osmId: (candidate as any).osmId });
    }
  }

  const existingBySource = await Hotspot.findOne({
    $or: sourceConditions,
  }).select("_id title location sourceId mapboxId osmId");

  if (existingBySource) return existingBySource;

  const nearbyHotspots = await Hotspot.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 100,
      },
    },
  }).select("_id title location");

  const existingByName = nearbyHotspots.find(
    (hotspot) => normalizeCandidateName(hotspot.title) === normalizedName,
  );
  if (existingByName) return existingByName;

  if (!normalizedAddress) return null;

  return Hotspot.findOne({
    "location.address": { $regex: candidate.address || "", $options: "i" },
  }).select("_id title location");
};

const buildOverpassQuery = (
  osmTags: Record<string, string>[],
  overpassBbox: [number, number, number, number],
) => {
  const bbox = overpassBbox.join(",");
  const queries = osmTags.flatMap((tag) => {
    return Object.entries(tag).flatMap(([key, value]) => {
      const selector = `["${key}"="${value}"]`;
      return [
        `node${selector}(${bbox});`,
        `way${selector}(${bbox});`,
        `relation${selector}(${bbox});`,
      ];
    });
  });

  return `[out:json][timeout:25];(${queries.join("")});out center tags;`;
};

const fetchOverpassData = async (query: string) => {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastError: any;

  for (const endpoint of endpoints) {
    try {
      const body = new URLSearchParams({ data: query }).toString();
      const { data } = await axios.post(endpoint, body, {
        timeout: 30000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "Skaute API hotspot importer",
        },
      });

      return data;
    } catch (error: any) {
      lastError = error;
      const responseBody =
        typeof error.response?.data === "string"
          ? error.response.data.slice(0, 500)
          : JSON.stringify(error.response?.data || {}).slice(0, 500);

      logger.warn(
        `OSM Overpass preview failed: endpoint=${endpoint} status=${error.response?.status || "NO_RESPONSE"} message=${error.message} body=${responseBody}`,
      );
    }
  }

  throw lastError;
};

const toOsmCandidate = ({
  element,
  category,
  area,
  rejectRegex,
}: {
  element: any;
  category: string;
  area: string;
  rejectRegex: RegExp;
}): OsmHotspotCandidate | null => {
  const tags = element.tags || {};
  const name = tags.name || tags["name:en"];
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;

  if (!name || lat === undefined || lng === undefined) return null;
  if (rejectRegex.test(name)) return null;

  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ]
    .filter(Boolean)
    .join(", ");

  return {
    source: "osm",
    sourceId: `${element.type}/${element.id}`,
    osmId: String(element.id),
    osmType: element.type,
    name,
    category:
      tags.amenity || tags.tourism || tags.leisure || tags.shop || category,
    address,
    neighborhood:
      tags["addr:suburb"] ||
      tags.neighbourhood ||
      tags["is_in:neighbourhood"] ||
      area,
    coordinates: [Number(lng), Number(lat)],
    confidence: 0.8,
  };
};

export const previewOsmHotspotCandidates = async ({
  category,
  area,
  osmTags,
  overpassBbox,
  limit,
  rejectNamePattern,
}: {
  category: string;
  area: string;
  osmTags: Record<string, string>[];
  overpassBbox: [number, number, number, number];
  limit: number;
  rejectNamePattern?: string;
}) => {
  const clampedLimit = Math.min(Number(limit) || 25, 50);
  const cacheKey = JSON.stringify({
    category,
    area,
    osmTags,
    overpassBbox,
    clampedLimit,
    rejectNamePattern,
  });
  const cached = osmPreviewCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.candidates;
  }

  const rejectRegex = new RegExp(
    rejectNamePattern ||
      "road|rd|street|st|avenue|ave|expressway|highway|bypass|junction|roundabout|bridge|flyover|lane|drive|close|way|route",
    "i",
  );

  try {
    const data = await fetchOverpassData(
      buildOverpassQuery(osmTags, overpassBbox),
    );

    const rawCandidates = (data.elements || [])
      .map((element: any) =>
        toOsmCandidate({ element, category, area, rejectRegex }),
      )
      .filter(Boolean)
      .slice(0, clampedLimit);

    const candidates = await Promise.all(
      rawCandidates.map(async (candidate: OsmHotspotCandidate) => {
        const existing = await findDuplicateHotspot(candidate as any);
        return {
          ...candidate,
          alreadyExists: Boolean(existing),
          existingHotspotId: existing?._id?.toString() || null,
        };
      }),
    );

    osmPreviewCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      candidates,
    });

    return candidates;
  } catch {
    throw new AppError(httpStatus.BAD_GATEWAY, "Could not preview OSM venues");
  }
};

export const previewMapboxHotspotCandidates = async ({
  category,
  area,
  keyword,
  radiusMeters,
  limit,
}: {
  category: string;
  area: string;
  keyword?: string;
  radiusMeters: number;
  limit: number;
}) => {
  if (!config.mapbox.accessToken) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Mapbox access token is not configured.",
    );
  }

  const areaCenter = PH_AREAS[area] || PH_AREAS["Port Harcourt"];
  if (!areaCenter) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid Port Harcourt area.");
  }

  const clampedLimit = Math.min(Number(limit) || 25, 25);
  const searchText = `${keyword || category} ${area} Port Harcourt Nigeria`;

  try {
    let data;
    const categoryUrl = `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}`;
    try {
      const response = await axios.get(categoryUrl, {
        params: {
          proximity: `${areaCenter.lng},${areaCenter.lat}`,
          country: "NG",
          limit: clampedLimit,
          access_token: config.mapbox.accessToken,
        },
      });
      data = response.data;
    } catch {
      const textUrl = `https://api.mapbox.com/search/geocode/v6/forward`;
      const response = await axios.get(textUrl, {
        params: {
          q: searchText,
          proximity: `${areaCenter.lng},${areaCenter.lat}`,
          country: "NG",
          limit: clampedLimit,
          access_token: config.mapbox.accessToken,
        },
      });
      data = response.data;
    }

    const rawFeatures = data.features || data.suggestions || [];
    const candidates = rawFeatures
      .map((feature: any) => toMapboxCandidate(feature, category, areaCenter))
      .filter((candidate: any) => {
        return candidate && (!radiusMeters || candidate.distanceMeters <= radiusMeters);
      })
      .slice(0, clampedLimit);

    return Promise.all(
      candidates.map(async (candidate: any) => {
        const existing = await findDuplicateHotspot(candidate);
        return {
          ...candidate,
          address: candidate.address || "",
          neighborhood: candidate.neighborhood || area,
          alreadyExists: Boolean(existing),
          existingHotspotId: existing?._id?.toString() || null,
        };
      }),
    );
  } catch {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Could not preview Mapbox venues",
    );
  }
};

export const importMapboxHotspotCandidates = async (
  candidates: MapboxHotspotCandidate[],
  adminUserId?: string,
) => {
  const imported = [];
  const skipped = [];

  for (const candidate of candidates) {
    const [lng, lat] = candidate.coordinates;
    const existing = await findDuplicateHotspot(candidate);

    if (existing) {
      skipped.push({
        sourceId: candidate.sourceId,
        reason: "duplicate",
        existingHotspotId: existing._id,
      });
      continue;
    }

    const hotspot = await Hotspot.create({
      title: candidate.name,
      description: "",
      category: mapMapboxCategoryToHotspotCategory(candidate.category || "other"),
      status: "ACTIVE",
      image: "https://picsum.photos/seed/skaute-hotspot/1200/800",
      gallery: [],
      location: {
        type: "Point",
        coordinates: [lng, lat],
        address: candidate.address || "",
        neighborhood: candidate.neighborhood || "",
        city: candidate.city || "Port Harcourt",
        state: candidate.state || "Rivers State",
      },
      features: [],
      isVerified: false,
      isActive: false,
      source: "mapbox",
      sourceId: candidate.sourceId,
      mapboxId: candidate.sourceId,
      sourceCategories: candidate.sourceCategories || [],
      importStatus: "needs_review",
      importedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      importedAt: new Date(),
    });

    imported.push(hotspot);
  }

  return { imported, skipped };
};

export const getHotspotContributionQueue = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;
  const filter: any = {};

  if (query.status) filter.status = query.status;
  else filter.status = "pending";
  if (query.type) filter.type = query.type;

  const [contributions, total] = await Promise.all([
    HotspotContribution.find(filter)
      .populate("hotspot", "title image location")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    HotspotContribution.countDocuments(filter),
  ]);

  return {
    contributions,
    pagination: {
      page,
      pages: Math.ceil(total / limit),
      total,
      limit,
    },
  };
};

const applyContributionToHotspot = async (hotspot: any, contribution: any) => {
  const payload = contribution.payload || {};

  if (contribution.type === "photo" && payload.imageUrl) {
    const currentGallery = hotspot.gallery || [];
    if (currentGallery.length < 5 && !currentGallery.includes(payload.imageUrl)) {
      hotspot.gallery = [...currentGallery, payload.imageUrl];
    }
  }

  if (contribution.type === "pin" && payload.coordinates?.length === 2) {
    hotspot.location = {
      ...hotspot.location,
      type: "Point",
      coordinates: payload.coordinates,
    };
  }

  if (contribution.type === "hours" && payload.metadata?.openingHours) {
    hotspot.openingHours = payload.metadata.openingHours;
  }

  if (contribution.type === "contact" && payload.value) {
    const value = String(payload.value).trim();
    hotspot.contact = hotspot.contact || {};

    if (/^@/.test(value) || value.includes("instagram.com")) {
      hotspot.contact.instagram = value;
    } else if (/^https?:\/\//i.test(value)) {
      hotspot.contact.website = value;
    } else {
      hotspot.contact.phone = value;
    }
  }

  if (contribution.type === "description" && payload.value) {
    hotspot.description = payload.value;
  }

  if (contribution.type === "closed") {
    hotspot.isActive = false;
  }

  await hotspot.save();
  return hotspot;
};

export const approveHotspotContribution = async (
  contributionId: string,
  adminId: string,
  adminNote?: string,
  applyMode: "auto" | "manual" = "auto",
) => {
  const contribution = await HotspotContribution.findById(contributionId);
  if (!contribution) {
    throw new AppError(httpStatus.NOT_FOUND, "Contribution not found");
  }

  const hotspot = await Hotspot.findById(contribution.hotspot);
  if (!hotspot) {
    throw new AppError(httpStatus.NOT_FOUND, "Hotspot not found");
  }

  let updatedHotspot = hotspot;
  if (applyMode === "auto") {
    updatedHotspot = await applyContributionToHotspot(hotspot, contribution);
  }

  contribution.status = "approved";
  contribution.reviewedBy = new mongoose.Types.ObjectId(adminId);
  contribution.reviewedAt = new Date();
  contribution.adminNote = adminNote;
  await contribution.save();

  return { contribution, hotspot: updatedHotspot };
};

export const rejectHotspotContribution = async (
  contributionId: string,
  adminId: string,
  adminNote?: string,
) => {
  const contribution = await HotspotContribution.findById(contributionId);
  if (!contribution) {
    throw new AppError(httpStatus.NOT_FOUND, "Contribution not found");
  }

  contribution.status = "rejected";
  contribution.reviewedBy = new mongoose.Types.ObjectId(adminId);
  contribution.reviewedAt = new Date();
  contribution.adminNote = adminNote;
  await contribution.save();

  return contribution;
};

export const processBulkTicketIssue = async (
  eventId: string,
  adminId: string,
  guests: {
    firstName: string;
    lastName: string;
    email: string;
    tierId: string;
  }[],
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!adminId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Admin authentication context is missing.",
      );
    }

    const event = await Event.findById(eventId).session(session);
    if (!event) {
      throw new AppError(httpStatus.NOT_FOUND, "Event not found");
    }

    if (event.isCancelled) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot issue tickets for a cancelled event",
      );
    }

    const tiersById = new Map<string, any>();
    event.ticketTiers.forEach((tier: any) => {
      if (tier._id) tiersById.set(tier._id.toString(), tier);
      if (tier.id) tiersById.set(tier.id.toString(), tier);
    });

    const requestedByTier = new Map<string, number>();
    guests.forEach((guest) => {
      requestedByTier.set(
        guest.tierId,
        (requestedByTier.get(guest.tierId) || 0) + 1,
      );
    });

    for (const [tierId, requestedCount] of requestedByTier.entries()) {
      const tier = tiersById.get(tierId);
      if (!tier) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Ticket tier not found for tierId ${tierId}`,
        );
      }

      const available = Number(tier.capacity || 0) - Number(tier.sold || 0);
      if (requestedCount > available) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `${tier.name} only has ${available} ticket(s) available, but ${requestedCount} guest(s) were submitted.`,
        );
      }
    }

    const createdTickets: any[] = [];
    const issuedOrders: any[] = [];

    for (const guest of guests) {
      const tier = tiersById.get(guest.tierId);
      const checkInCode = `SKT-BULK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const ticketCode = `REF-BULK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      const [order] = await Order.create(
        [
          {
            buyerEmail: guest.email.toLowerCase().trim(),
            event: event._id,
            tierName: tier.name,
            quantity: 1,
            totalAmount: 0,
            status: ORDER_STATUS.COMPLETED,
            paymentReference: ticketCode,
            paymentUrl: "bulk-complimentary",
            expiresAt: new Date(),
            paymentMethod: "complimentary",
            issuedBy: new mongoose.Types.ObjectId(adminId),
          },
        ],
        { session },
      );

      const [ticket] = await Ticket.create(
        [
          {
            event: event._id,
            owner: undefined,
            order: order._id,
            tierName: tier.name,
            pricePaid: 0,
            buyerInfo: {
              firstName: guest.firstName,
              lastName: guest.lastName,
              email: guest.email.toLowerCase().trim(),
            },
            ticketCode,
            checkInCode,
            status: TICKET_STATUS.valid,
          },
        ],
        { session },
      );

      tier.sold = Number(tier.sold || 0) + 1;
      createdTickets.push(ticket);
      issuedOrders.push(order);
    }

    event.attendees = Number(event.attendees || 0) + createdTickets.length;
    event.ticketsSold = Number(event.ticketsSold || 0) + createdTickets.length;
    await event.save({ session });

    await session.commitTransaction();

    createdTickets.forEach((ticket, index) => {
      skauteEvents.emit("order.fulfilled", {
        order: issuedOrders[index],
        tickets: [ticket],
        event,
        eventImage: event.image,
        isManualPlacement: true,
      });
    });

    return createdTickets;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const updateApprovalStatus = async (
  id: string,
  status: "approved" | "rejected",
  adminId: string,
  reason?: string,
) => {
  const event = await Event.findById(id).populate("organizer");

  if (!event) {
    throw new Error("Event not found");
  }

  const updateData: any = {
    approvalStatus: status,
    approvedBy: adminId,
  };

  if (status === "approved") {
    updateData.isActive = true;
    updateData.publishedAt = new Date();
    updateData.approvedAt = new Date();

    updateData.rejectionReason = "";
    updateData.rejectedAt = null;
  }

  if (status === "rejected") {
    updateData.isActive = false;

    updateData.rejectionReason = reason || "";
    updateData.rejectedAt = new Date();
  }

  const updatedEvent = await Event.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  // ASYNC BACKGROUND EMAIL
  skauteEvents.emit("event.moderated", {
    organizer: event.organizer,
    event,
    status,
    reason,
  });

  return updatedEvent;
};

export const getUsersList = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // 1. DYNAMIC SEARCH & FILTER MATRIX
  const filter: any = {};

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  // 2. PARALLEL RESOLUTION WITH AGGREGATION LOOKUP
  // We use an aggregation pipeline to compute matching users along with their total hosted event counts
  const [
    aggregatedUsers,
    totalUsersCount,
    activeCount,
    suspendedCount,
    pendingCount,
  ] = await Promise.all([
    User.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "events", // Looks up your collection name for Events
          localField: "_id",
          foreignField: "organizer",
          as: "hostedEvents",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          status: 1,
          isVerified: 1,
          createdAt: 1,
          eventsCount: { $size: "$hostedEvents" }, // Calculates dynamic value for frontend tables
        },
      },
    ]),
    User.countDocuments(filter),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "suspended" }),
    User.countDocuments({ status: "pending" }),
  ]);

  return {
    users: aggregatedUsers,
    pagination: {
      totalUsers: totalUsersCount,
      totalPages: Math.ceil(totalUsersCount / limit),
      page,
      limit,
      counts: {
        all: activeCount + suspendedCount + pendingCount,
        active: activeCount,
        suspended: suspendedCount,
        pending: pendingCount,
      },
    },
  };
};

/**
 * Updates a user's operational state status ("active" | "suspended")
 */
export const updateUserStatus = async (
  id: string,
  status: "active" | "suspended",
) => {
  const user = await User.findById(id);
  if (!user) return null;

  user.status = status;
  // Trigger userSchema's .pre("save") hook to automatically sync the hidden "active" boolean
  await user.save();

  return user;
};

/**
 * Updates an organizer's verification status
 */
export const updateUserVerification = async (
  id: string,
  isVerified: boolean,
) => {
  const user = await User.findByIdAndUpdate(
    id,
    { isVerified },
    { new: true, runValidators: true },
  ).select("name email role isVerified status createdAt");

  return user;
};

/**
 * Aggregates production-grade operational metrics tailored precisely to your
 * native Order, Event, and Ticket schema specifications.
 */
export const getPulseMetrics = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Skaute Platform Business Core Mechanics: 5.5% Platform Commission
  const SKAUTE_FEE_PERCENT = Number(config.skauteFeePercent) || 5.5;

  const [
    neighborhoodHeat,
    ticketVelocity,
    financialOverview,
    gateCheckInStats,
    pendingModerationCount,
    unverifiedOrganizersCount,
    cancelledEventsCount,
  ] = await Promise.all([
    // 1. NEIGHBORHOOD SIGNUPS (User Location Footprint)
    User.aggregate([
      { $match: { neighborhood: { $exists: true, $ne: null } } },
      { $group: { _id: "$neighborhood", signups: { $sum: 1 } } },
      { $sort: { signups: -1 } },
      { $limit: 10 },
    ]),

    // 2. TICKET VELOCITY (7-Day Sales Curve mapped to order quantities)
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: ORDER_STATUS.COMPLETED, // Evaluates to 'completed'
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          tickets: { $sum: "$quantity" },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 3. FINANCIAL OVERVIEW (Gross Processing Splits)
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 4. REAL-TIME GATE ADMITTANCE (Using structural checkedInAt properties)
    Ticket.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ["$checkedInAt", false] },
              "scanned",
              "unscanned",
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // 5. ESCALATION 1: Moves awaiting administrative review
    Event.countDocuments({ approvalStatus: "pending" }),

    // 6. ESCALATION 2: Unverified Organizers
    // Maps to your User model's verification checks for platform trust parameters
    User.countDocuments({ role: "organizer", isVerified: false }),

    // 7. ESCALATION 3: Flagged/Cancelled Moves that need remediation audit
    Event.countDocuments({ isCancelled: true }),
  ]);

  // Safe Financial Matrix Destructuring
  const grossCompletedRevenue =
    financialOverview.find((f) => f._id === ORDER_STATUS.COMPLETED)?.total || 0;

  // Platform Split Engine Mechanics
  const platformEarnings = grossCompletedRevenue * (SKAUTE_FEE_PERCENT / 100);
  const clearOrganizerEscrowPool = grossCompletedRevenue - platformEarnings;

  // Safe Check-In Parsing
  const totalTicketsDistributed = gateCheckInStats.reduce(
    (acc, curr) => acc + curr.count,
    0,
  );
  const totalCheckedIn =
    gateCheckInStats.find((s) => s._id === "scanned")?.count || 0;

  return {
    neighborhoods: neighborhoodHeat.map((n: { _id: any; signups: any }) => ({
      name: n._id,
      signups: n.signups,
    })),

    velocity: ticketVelocity.map((v) => ({
      _id: v._id,
      orders: v.orders,
      tickets: v.tickets,
      revenue: v.revenue,
    })),

    finances: {
      totalRevenue: grossCompletedRevenue, // Platform Gross Processing Volume (GMV)
      pendingAmount: clearOrganizerEscrowPool, // Escrow balance to allocate to organizers
      platformCommission: platformEarnings, // Skaute Net Take-Rate Earnings
    },

    engagement: {
      totalTickets: totalTicketsDistributed,
      checkedIn: totalCheckedIn,
    },

    escalations: {
      pendingModerationCount,
      unverifiedOrganizersCount,
      activeDisputesCount: cancelledEventsCount, // Re-routed to track cancelled items requiring automated processing
    },
  };
};

/**
 * Aggregates production-grade management data for an event.
 */
export const getEventManagementDetails = async (eventId: string) => {
  const [event, orders, tickets] = await Promise.all([
    // 1. Fetch core event and host details
    Event.findById(eventId).populate("organizer", "name email image"),

    // 2. Fetch successful transactions only (Online Pipe)
    Order.find({
      event: eventId,
      status: ORDER_STATUS.COMPLETED,
    })
      .sort("-createdAt")
      .populate("user", "name email"),

    // 3. Fetch all issued tickets (Includes physical door entries)
    Ticket.find({ event: eventId }).sort("-createdAt"),
  ]);

  if (!event) return null;

  // --- COMPREHENSIVE FINANCIAL SPLIT RECONCILIATION ENGINE ---
  const platformFeePercent = event.platformFeePercent ?? 5.5;

  // 1. Online Channel Metrics
  const onlineGrossRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const onlineSkauteFee = (onlineGrossRevenue * platformFeePercent) / 100;
  const onlineOrganizerNet = onlineGrossRevenue - onlineSkauteFee;

  // 2. Physical Gate Channel Metrics (Accurately targeted based on your Mongoose doc structure)
  const physicalTickets = tickets.filter((t) => {
    const hasGateFlags = t.purchaseChannel === "gate" || t.isManualFormItem;
    const isGateCode =
      t.buyerInfo?.ticketCode?.startsWith("REF-MAN-") ||
      t.checkInCode?.startsWith("SKT-MAN-");

    return hasGateFlags || isGateCode;
  });

  const physicalGrossRevenue = physicalTickets.reduce(
    (sum, ticket) => sum + Number(ticket.pricePaid || 0),
    0,
  );
  const physicalSkauteFeeDebt =
    (physicalGrossRevenue * platformFeePercent) / 100;
  const physicalOrganizerCollectedCash =
    physicalGrossRevenue - physicalSkauteFeeDebt;

  // --- QUANTITY COUNT METRICS ---
  const doorTicketsCount = physicalTickets.length;
  const onlineTicketsCount = Math.max(tickets.length - doorTicketsCount, 0);

  // 3. Overall Totals
  const combinedGrossRevenue = onlineGrossRevenue + physicalGrossRevenue;
  const totalSkauteCommissions = onlineSkauteFee + physicalSkauteFeeDebt;
  const organizerLifetimeNetWorth =
    onlineOrganizerNet + physicalOrganizerCollectedCash;

  // 4. Liquid Escrow Vault Clearance (The exact pool eligible for manual admin withdrawal approvals)
  const totalPayoutCompleted = event.totalPayoutCompleted ?? 0;
  const totalPayoutProcessing = event.totalPayoutProcessing ?? 0;
  const withdrawableBalance = Math.max(
    onlineOrganizerNet -
      physicalSkauteFeeDebt -
      totalPayoutCompleted -
      totalPayoutProcessing,
    0,
  );

  // Identify check-ins based on your Ticket schema status
  const checkedInCount = tickets.filter(
    (t) => t.status === TICKET_STATUS.used || t.status === "used",
  ).length;

  return {
    event,
    orders,
    tickets,
    analytics: {
      totalRevenue: combinedGrossRevenue,
      totalTicketsSold: tickets.length,
      onlineTicketsCount, // 🔥 Added: Total tickets bought via the app/web
      doorTicketsCount, // 🔥 Added: Total tickets issued at the physical venue gate
      checkInCount: checkedInCount,
      checkInRate:
        tickets.length > 0
          ? Math.round((checkedInCount / tickets.length) * 100)
          : 0,
      capacityUtilization: event.totalCapacity
        ? Math.round((tickets.length / event.totalCapacity) * 100)
        : 100,
    },
    financials: {
      config: { platformFeePercent },
      overallTotals: {
        combinedGrossRevenue,
        totalSkauteCommissions,
        organizerLifetimeNetWorth,
      },
      onlineSalesChannel: {
        grossRevenue: onlineGrossRevenue,
        skauteCommissions: onlineSkauteFee,
        cleanNetPool: onlineOrganizerNet,
      },
      physicalGateChannel: {
        grossRevenue: physicalGrossRevenue,
        skauteCommissionsDebt: physicalSkauteFeeDebt,
        organizerCollectedCash: physicalOrganizerCollectedCash,
      },
      skauteVaultLedger: {
        initialHeldCash: onlineOrganizerNet,
        deductions: {
          gateCommissionsClawback: physicalSkauteFeeDebt,
          payoutsTransferred: totalPayoutCompleted,
          payoutsLockedInTransit: totalPayoutProcessing,
        },
        finalWithdrawableBalance: withdrawableBalance,
      },
    },
  };
};

/**
 * Mutates discovery engine parameters and forces a recalculation of priority fields
 */
export const updateEventPromotionStatus = async (
  id: string,
  adminId: string,
  promotionData: any,
) => {
  const event = await Event.findById(id);
  if (!event) return null;

  // 1. Handle Status Array Updates ("verified", "featured")
  if (promotionData.statusArray !== undefined) {
    const oldStatus = [...event.status];
    event.status = promotionData.statusArray;

    // Track operational timestamps for record-keeping
    if (
      promotionData.statusArray.includes("verified") &&
      !oldStatus.includes("verified")
    ) {
      event.verifiedAt = new Date();
    }
    if (
      promotionData.statusArray.includes("featured") &&
      !oldStatus.includes("featured")
    ) {
      event.featuredAt = new Date();
    }
  }

  // 2. Handle Skaute Hosted Flag Toggle
  if (promotionData.isSkauteHosted !== undefined) {
    event.isSkauteHosted = promotionData.isSkauteHosted;
  }

  // 3. Handle Commercial Boosting Pipeline
  if (promotionData.isBoosted !== undefined) {
    event.isBoosted = promotionData.isBoosted;

    if (promotionData.isBoosted) {
      event.boostTier = promotionData.boostTier || "standard";
      event.boostedBy = adminId;

      // Compute future expiration date (defaults to 7 days if not provided)
      const days = Number(promotionData.boostDays) || 7;
      event.boostExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      // Clear boost metadata if stripped
      event.boostTier = "none";
      event.boostExpiry = undefined;
      event.boostedBy = undefined;
    }
  }

  // 4. Critical Step: Save document instance to trigger .pre("save") hook calculation
  await event.save();
  return event;
};

export const getPayoutsList = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.status) {
    filter.status = query.status;
  }

  const [payouts, total] = await Promise.all([
    Payout.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("organizer", "name email")
      .populate("event", "title")
      .lean(),

    Payout.countDocuments(filter),
  ]);

  return {
    payouts,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const processManualPayoutCompletion = async (
  id: string,
  reference: string,
) => {
  const payout = await Payout.findOne({ _id: id, status: "pending" });
  if (!payout) return null;

  // 1. Update status tracking attributes
  payout.status = "completed";
  payout.paymentReference = reference;
  payout.paidAt = new Date();

  await payout.save();
  await Transaction.create({
    organizer: payout.organizer,
    amount: payout.amount,
    type: "payout",
    status: "success",
    reference: reference,
    description: `Manual balance settlement clearance transfer to ${payout.bankDetails.accountName}`,
  });

  return payout;
};

export const getGateTelemetry = async (query: any) => {
  // Aggregate real-time validation actions across active event spaces using ScanLog
  const aggregateLogs = await ScanLog.aggregate([
    {
      $match: {
        status: SCAN_LOG_STATUS.SUCCESS, // Tracks valid admissions
      },
    },
    {
      $group: {
        _id: "$event",
        totalScans: { $sum: 1 },
        lastScanTime: { $max: "$scannedAt" },
      },
    },
    { $sort: { lastScanTime: -1 } },
    { $limit: 20 },
  ]);

  return await Event.populate(aggregateLogs, {
    path: "_id",
    select: "title location organizer",
  });
};

export const getTelemetryDataset = async (eventId?: string) => {
  const filter: any = {};
  if (eventId) {
    filter.event = new mongoose.Types.ObjectId(eventId);
  }

  // 1. Resolve general counts concurrently
  const [totalTicketsCount, checkedInCount] = await Promise.all([
    Ticket.countDocuments(eventId ? { event: eventId } : {}),
    Ticket.countDocuments({
      ...(eventId ? { event: eventId } : {}),
      status: TICKET_STATUS.used,
    }),
  ]);

  // 2. Query ScanLogs to pull deep live feeds, terminal state statistics, and exceptions
  const [recentLogs, terminalAggregation, fraudLogs] = await Promise.all([
    // Live feed pipeline: Includes ticket metadata payloads by populating the referenced doc
    ScanLog.find({ ...filter, status: SCAN_LOG_STATUS.SUCCESS })
      .sort("-scannedAt")
      .limit(50)
      .populate("ticket", "buyerInfo tierName checkInCode")
      .populate("scanner", "name email") // Populates who checked it in
      .lean(),

    // Target terminal hardware device counters
    ScanLog.aggregate([
      {
        $match: {
          ...filter,
          deviceFingerprint: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$deviceFingerprint",
          scanCount: { $sum: 1 },
          lastActive: { $max: "$scannedAt" },
          // Pulls the name of the last staff user who operated this device fingerprint
          lastOperatorId: { $last: "$scanner" },
        },
      },
    ]),

    // Pull collision anomalies to process into the active threat array
    ScanLog.find({
      ...filter,
      status: {
        $in: [SCAN_LOG_STATUS.DUPLICATE, SCAN_LOG_STATUS.INVALID_EVENT],
      },
    })
      .sort("-scannedAt")
      .limit(30)
      .populate("ticket", "buyerInfo checkInCode")
      .lean(),
  ]);

  // 3. Hydrate Terminal Operator identities if active hardware is detected
  let terminals: any[] = [];
  if (terminalAggregation.length > 0) {
    terminals = await Event.populate(terminalAggregation, {
      path: "lastOperatorId",
      model: "User",
      select: "name",
    });

    terminals = terminals.map((term: any) => ({
      deviceId: term._id ? String(term._id).substring(0, 13) : "UNKNOWN-HWID",
      operatorName: term.lastOperatorId?.name || "Gate Staff",
      scanCount: term.scanCount || 0,
      status:
        Date.now() - new Date(term.lastActive).getTime() < 10 * 60 * 1000
          ? "online"
          : "offline",
    }));
  }

  // 4. Transform native logs into cleanly mapped live analytics outputs
  const liveFeed = recentLogs.map((log: any) => {
    const t = log.ticket;
    return {
      ticketId: t?._id?.toString() || log.ticket?.toString(),
      guestName: t?.buyerInfo
        ? `${t.buyerInfo.firstName} ${t.buyerInfo.lastName}`
        : "Registered Guest",
      tier: t?.tierName || "Standard Access",
      code: t?.checkInCode || "VERIFIED",
      deviceId: log.deviceFingerprint
        ? String(log.deviceFingerprint).substring(0, 13)
        : "OFFLINE-TERM",
      timestamp: log.scannedAt,
    };
  });

  // 5. Structure active threat parameters into fraud panels
  const fraudAlerts = fraudLogs.map((log: any) => {
    const t = log.ticket;
    return {
      type: log.status,
      severity:
        log.status === SCAN_LOG_STATUS.DUPLICATE ? "CRITICAL" : "MEDIUM",
      code: t?.checkInCode || "UNKNOWN_CODE",
      guestName: t?.buyerInfo
        ? `${t.buyerInfo.firstName} ${t.buyerInfo.lastName}`
        : "Unknown Attendee",
      message:
        log.status === SCAN_LOG_STATUS.DUPLICATE
          ? "Ticket duplication alert! Ticket reuse attempt rejected at gateway terminal."
          : "Cross-venue scan mismatch! This pass belongs to an entirely different event perimeter.",
      timestamp: log.scannedAt,
    };
  });

  // 6. Sliding Entry Velocity calculation
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyLogsCount = await ScanLog.countDocuments({
    ...filter,
    status: SCAN_LOG_STATUS.SUCCESS,
    scannedAt: { $gte: oneHourAgo },
  });
  const scansPerMinute = Math.ceil(hourlyLogsCount / 60) || 0;

  return {
    summary: {
      verifiedCount: checkedInCount,
      totalTicketsSold: totalTicketsCount,
      activeDevicesCount: terminals.filter((t) => t.status === "online").length,
      scansPerMinute,
      fraudAlertsCount: fraudAlerts.length,
    },
    terminals,
    fraudAlerts,
    liveFeed,
  };
};
