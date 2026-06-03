import { Router } from "express";
import * as hotspotController from "../controllers/hotspotController.js";
import { validate } from "../middleware/validate.js";
import {
  createHotspotSchema,
  castVibeCheckSchema,
  getHotspotDetailsSchema,
} from "../validation/hotspotValidation.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// 🗺️ Public Map Routes
router.get("/", hotspotController.getAllHotspots);
router.get(
  "/:hotspotId",
  validate(getHotspotDetailsSchema),
  hotspotController.getHotspotDetails,
);

router.post(
  "/:hotspotId/vibe",
  protect,
  validate(castVibeCheckSchema),
  hotspotController.castHotspotVibeCheck,
);

router.post(
  "/",
  protect,
  restrictTo("admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  hotspotController.createHotspot,
);

export default router;
