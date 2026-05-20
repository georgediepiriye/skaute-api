import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { User } from "../models/User.js";
import config from "./config.js";
import skauteEvents from "../utils/eventsEmitter.js";

type GoogleProfile = Profile & {
  _json: {
    given_name?: string;
    family_name?: string;
    email_verified?: boolean;
    picture?: string;
  };
};

passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleOAuth.clientId,
      clientSecret: config.googleOAuth.clientSecret,
      callbackURL: `${config.apiUrl}/v1/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleProfile = profile as GoogleProfile;

        const email = googleProfile.emails?.[0].value;

        // Comprehensive fallback architecture for both fields
        const firstName =
          googleProfile.name?.givenName || googleProfile._json.given_name || "";

        const lastName =
          googleProfile.name?.familyName ||
          googleProfile._json.family_name ||
          "";

        // Account Linking Logic
        let user = await User.findOne({
          $or: [{ googleId: googleProfile.id }, { email: email }],
        });

        if (user) {
          if (!user.googleId) {
            user.googleId = googleProfile.id;
            if (!user.image) user.image = googleProfile.photos?.[0].value;
            await user.save();
          }
          return done(null, user);
        }

        // Clean double-spaces if a particular name element didn't fetch cleanly
        const finalName = `${firstName} ${lastName}`.trim() || "Google User";

        // New User Creation
        user = await User.create({
          googleId: googleProfile.id,
          name: finalName,
          email: email,
          image: googleProfile.photos?.[0].value,
        });

        // Trigger your global welcome emails via the event system
        skauteEvents.emit("user.signup", { user });

        return done(null, user);
      } catch (err) {
        return done(err as Error, false);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id } as any));

export default passport;
