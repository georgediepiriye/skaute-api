import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import * as userController from "../controllers/userController.js";
import { updateProfileSchema } from "../validation/userValidation.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../utils/rateLimitter.js";

const router = Router();

router.get("/profile", protect, userController.getProfile);
router.patch(
  "/updateMe",
  writeLimiter,
  protect,
  validate(updateProfileSchema),
  userController.updateProfile,
);
export default router;
