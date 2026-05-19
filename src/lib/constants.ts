export const USER_ROLES = {
  USER: "user",
  ORGANIZER: "organizer",
  ADMIN: "admin",
} as const;

export const ORDER_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;

export const EVENT_TYPES = {
  activity: {
    label: "Activity",
    slug: "activity",
    description: "Community-driven gatherings and social meetups.",
    defaultStatus: "casual",
  },
  showcase: {
    label: "Showcase",
    slug: "showcase",
    description: "Professional events and curated brand experiences.",
    defaultStatus: "verified",
  },
} as const;

export const EVENT_CATEGORIES = {
  // --- CORE SOCIAL ---
  social: {
    label: "Social",
    color: "bg-yellow-100 text-yellow-800",
  },
  hangout: {
    label: "Hangout",
    color: "bg-amber-100 text-amber-800",
  },
  party: {
    label: "Party",
    color: "bg-rose-100 text-rose-800",
  },
  culture: {
    label: "Culture",
    color: "bg-emerald-100 text-emerald-800",
  },

  // --- LIFESTYLE & WELLNESS ---
  wellness: {
    label: "Wellness",
    color: "bg-cyan-100 text-cyan-800",
  },
  fitness: {
    label: "Fitness",
    color: "bg-blue-100 text-blue-800",
  },
  sports: {
    label: "Sports",
    color: "bg-green-100 text-green-800",
  },

  // --- ENTERTAINMENT ---
  entertainment: {
    label: "Entertainment",
    color: "bg-pink-50 text-rose-700",
  },
  music: {
    label: "Music",
    color: "bg-pink-100 text-pink-800",
  },
  gaming: {
    label: "Gaming",
    color: "bg-violet-100 text-violet-800",
  },

  // --- FOOD & COMMERCE ---
  food: {
    label: "Food",
    color: "bg-orange-100 text-orange-800",
  },
  market: {
    label: "Market",
    color: "bg-lime-100 text-lime-800",
  },

  // --- PROFESSIONAL & GROWTH ---
  business: {
    label: "Business",
    color: "bg-indigo-100 text-indigo-800",
  },
  tech: {
    label: "Tech",
    color: "bg-purple-100 text-purple-800",
  },
  education: {
    label: "Education",
    color: "bg-teal-100 text-teal-800",
  },

  // --- COMMUNITY ---
  religious: {
    label: "Religious",
    color: "bg-gray-200 text-gray-800",
  },
} as const;

/**
 * HOTSPOT CATEGORIES
 * Designed for location-based discovery and map filtering.
 */
export const HOTSPOT_CATEGORIES = {
  // --- HIGH ENERGY ---
  nightlife: {
    label: "Nightlife",
    slug: "nightlife",
    description: "Clubs, bars, and late-night entertainment.",
    icon: "Music",
  },
  lounge: {
    label: "Lounge",
    slug: "lounge",
    description: "Relaxed settings for drinks and conversation.",
    icon: "Beer",
  },

  // --- CULINARY ---
  dining: {
    label: "Dining",
    slug: "dining",
    description: "Restaurants and casual food spots.",
    icon: "Utensils",
  },
  cafe: {
    label: "Cafe",
    slug: "cafe",
    description: "Coffee shops and breakfast nooks.",
    icon: "Coffee",
  },

  // --- PRODUCTIVITY & CULTURE ---
  workspace: {
    label: "Workspace",
    slug: "workspace",
    description: "Co-working spaces and quiet study zones.",
    icon: "Laptop",
  },
  arts: {
    label: "Arts & Gallery",
    slug: "arts",
    description: "Creative hubs and exhibition spaces.",
    icon: "Palette",
  },

  // --- ACTIVE & OUTDOORS ---
  wellness: {
    label: "Wellness Hub",
    slug: "wellness",
    description: "Gyms, parks, and recreational centers.",
    icon: "Heart",
  },
  retail: {
    label: "Retail Hub",
    slug: "retail",
    description: "Malls and popular shopping districts.",
    icon: "ShoppingBag",
  },
} as const;

/**
 * HOTSPOT HEAT LEVELS
 * Used for real-time map styling and dynamic pin colors.
 */
export const HOTSPOT_STATUS = {
  CHILL: { label: "Chill", color: "#64748b" }, // Slate
  ACTIVE: { label: "Active", color: "#3b82f6" }, // Blue
  TRENDING: { label: "Trending", color: "#f59e0b" }, // Amber
  HOT: { label: "Live Hotspot", color: "#ef4444" }, // Red
} as const;

/**
 * TICKET STATUS
 * Tracking the lifecycle of a purchase from issuance to entry.
 */
export const TICKET_STATUS = {
  valid: "valid", // Ticket is active and ready for use
  used: "used", // Ticket has been scanned (Checked-in)
  refunded: "refunded", // Money returned to buyer, ticket invalidated
  cancelled: "cancelled", // Ticket voided by admin (e.g., chargeback/fraud)
  transferred: "transferred", //  Ticket forwarded to another user
} as const;

export type skauteType = keyof typeof EVENT_TYPES;
export type EventCategory = keyof typeof EVENT_CATEGORIES;
export type HotspotCategory = keyof typeof HOTSPOT_CATEGORIES;
export type HotspotStatus = keyof typeof HOTSPOT_STATUS;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
