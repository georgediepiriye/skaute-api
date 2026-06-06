import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // max requests per IP
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // VERY strict
  message: "Too many login attempts. Try again later.",
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // moderate
});
