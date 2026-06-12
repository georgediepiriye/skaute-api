import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { signupSchema, loginSchema } from "../validation/authValidation.js";
import { protect } from "../middleware/authMiddleware.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import { authLimiter, loginLimiter, oauthLimiter } from "../utils/rateLimitter.js";

const router = Router();

router.post("/signup", authLimiter, validate(signupSchema), authController.signup);
router.post("/login", loginLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);

router.get("/me", protect, authController.getMe);

// 1. Redirect user to Google
router.get("/google", oauthLimiter, (req, res, next) => {
  const callbackUrl = (req.query.callbackUrl as string) || "/profile";
  const statePayload = Buffer.from(JSON.stringify({ callbackUrl })).toString(
    "base64",
  );

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: statePayload,
  })(req, res, next);
});

// 2. Google redirects back here
router.get(
  "/google/callback",
  oauthLimiter,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${config.clientUrl}/auth/signin?error=OAuthFailed`,
  }),
  (req, res) => {
    const user = req.user as any;

    // 1. Generate the session token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      config.jwt.secret!,
      { expiresIn: "7d" },
    );

    // 2. Extract the original dynamic target path from Passport's state parameter
    // If no state or redirect path was provided, fallback safely to '/profile'
    let redirectTo = "/profile";

    if (req.query.state) {
      try {
        // If you stringified an object into state, parse it here
        const stateData = JSON.parse(
          Buffer.from(req.query.state as string, "base64").toString(),
        );
        if (stateData.callbackUrl) {
          redirectTo = stateData.callbackUrl;
        }
      } catch (e) {
        // If state was just a raw string instead of base64/JSON
        if (
          typeof req.query.state === "string" &&
          req.query.state.startsWith("/")
        ) {
          redirectTo = req.query.state;
        }
      }
    }

    // 3. Redirect back to your Next.js client callback route,
    // appending both the auth token AND the final destination route
    const encodedRedirect = encodeURIComponent(redirectTo);
    res.redirect(
      `${config.clientUrl}/auth/callback?token=${token}&redirect=${encodedRedirect}`,
    );
  },
);

export default router;
