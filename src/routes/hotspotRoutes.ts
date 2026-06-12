import { Router } from "express";
import * as hotspotController from "../controllers/hotspotController.js";
import { validate } from "../middleware/validate.js";
import {
  createHotspotSchema,
  castVibeCheckSchema,
  createHotspotContributionSchema,
  createHotspotSuggestionSchema,
  deleteHotspotSchema,
  getHotspotDetailsSchema,
  toggleHotspotActiveSchema,
  updateHotspotSchema,
} from "../validation/hotspotValidation.js";
import { optionalProtect, protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  contributionLimiter,
  uploadLimiter,
  writeLimiter,
} from "../utils/rateLimitter.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });
const suggestionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});
const contributionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

const parseContributionPayload = (req: any, _: any, next: any) => {
  if (typeof req.body?.payload === "string") {
    try {
      req.body.payload = JSON.parse(req.body.payload || "{}");
    } catch {
      req.body.payload = {};
    }
  }
  next();
};

const parseSuggestionPayload = (req: any, _: any, next: any) => {
  if (typeof req.body?.suggestionData === "string") {
    try {
      req.body = JSON.parse(req.body.suggestionData || "{}");
    } catch {
      req.body = {};
    }
  }
  next();
};

const router = Router();

router.get("/", hotspotController.getAllHotspots);
router.get(
  "/:hotspotId",
  validate(getHotspotDetailsSchema),
  hotspotController.getHotspotDetails,
);

router.post(
  "/suggestions",
  contributionLimiter,
  optionalProtect,
  suggestionUpload.single("image"),
  parseSuggestionPayload,
  validate(createHotspotSuggestionSchema),
  hotspotController.createHotspotSuggestion,
);

router.post(
  "/",
  uploadLimiter,
  protect,
  restrictTo("admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  validate(createHotspotSchema),
  hotspotController.createHotspot,
);

router.patch(
  "/:hotspotId/toggle-active",
  writeLimiter,
  protect,
  restrictTo("admin"),
  validate(toggleHotspotActiveSchema),
  hotspotController.toggleHotspotActive,
);

router.patch(
  "/:hotspotId",
  uploadLimiter,
  protect,
  restrictTo("admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  validate(updateHotspotSchema),
  hotspotController.updateHotspot,
);

router.delete(
  "/:hotspotId",
  writeLimiter,
  protect,
  restrictTo("admin"),
  validate(deleteHotspotSchema),
  hotspotController.deleteHotspot,
);

router.post(
  "/:hotspotId/vibe",
  writeLimiter,
  protect,
  validate(castVibeCheckSchema),
  hotspotController.castHotspotVibeCheck,
);

router.post(
  "/:hotspotId/contributions",
  contributionLimiter,
  contributionUpload.single("image"),
  parseContributionPayload,
  validate(createHotspotContributionSchema),
  hotspotController.createHotspotContribution,
);

export default router;
