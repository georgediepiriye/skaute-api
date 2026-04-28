import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { User } from "../models/User.js";
import config from "./config.js";

// Use an intersection type (&) instead of 'extends'
// This merges the standard Profile with our specific _json needs
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
        // Cast to our combined type
        const googleProfile = profile as GoogleProfile;

        const email = googleProfile.emails?.[0].value;
        const firstName =
          googleProfile._json.given_name || googleProfile.name?.givenName;
        const lastName =
          googleProfile._json.family_name || googleProfile.name?.familyName;

        // 1. Account Linking Logic
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

        // 2. New User Creation
        user = await User.create({
          googleId: googleProfile.id,
          name: `${firstName} ${lastName}`.trim(),
          email: email,
          image: googleProfile.photos?.[0].value,
        });

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
