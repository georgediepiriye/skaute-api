import { Router } from "express";
import * as hotspotController from "../controllers/hotspotController.js";
import { validate } from "../middleware/validate.js";
import {
  createHotspotSchema,
  castVibeCheckSchema,
  getHotspotDetailsSchema,
} from "../validation/hotspotValidation.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

// 🗺️ Public Map Routes
router.get("/", hotspotController.getAllHotspots);
router.get(
  "/:hotspotId",
  validate(getHotspotDetailsSchema),
  hotspotController.getHotspotDetails,
);

// 🔒 Protected App Interaction Routes
router.post(
  "/:hotspotId/vibe-check",
  protect,
  validate(castVibeCheckSchema),
  hotspotController.castHotspotVibeCheck,
);

// 👑 Admin Control Routes (B2B Seed Platform Pipeline Setup)
router.post(
  "/",
  protect,
  restrictTo("admin"),
  validate(createHotspotSchema),
  hotspotController.createHotspot,
);

export default router;
