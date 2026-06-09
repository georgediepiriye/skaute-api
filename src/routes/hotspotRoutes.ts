import { Router } from "express";
import * as hotspotController from "../controllers/hotspotController.js";
import { validate } from "../middleware/validate.js";
import {
  createHotspotSchema,
  castVibeCheckSchema,
  deleteHotspotSchema,
  getHotspotDetailsSchema,
  updateHotspotSchema,
} from "../validation/hotspotValidation.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get("/", hotspotController.getAllHotspots);
router.get(
  "/:hotspotId",
  validate(getHotspotDetailsSchema),
  hotspotController.getHotspotDetails,
);

router.post(
  "/",
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
  "/:hotspotId",
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
  protect,
  restrictTo("admin"),
  validate(deleteHotspotSchema),
  hotspotController.deleteHotspot,
);

router.post(
  "/:hotspotId/vibe",
  protect,
  validate(castVibeCheckSchema),
  hotspotController.castHotspotVibeCheck,
);

export default router;
