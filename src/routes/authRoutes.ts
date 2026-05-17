import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { signupSchema, loginSchema } from "../validation/authValidation.js";
import { protect } from "../middleware/authMiddleware.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

const router = Router();

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);

// 🔐 Secure endpoint
router.get("/me", protect, authController.getMe);

// 1. Redirect user to Google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

// 2. Google redirects back here
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${config.clientUrl}/login`,
  }),
  (req, res) => {
    const user = req.user as any;

    const token = jwt.sign(
      { id: user._id, role: user.role },
      config.jwt.secret!,
      { expiresIn: "7d" },
    );

    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  },
);

export default router;
