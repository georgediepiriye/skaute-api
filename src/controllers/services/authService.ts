import { User, IUser } from "../../models/User.js";
import httpStatus from "http-status";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js"; // Import your winston logger

export const createUser = async (userData: Partial<IUser>) => {
  const existingUser = await User.findOne({ email: userData.email });

  if (existingUser) {
    // SECURITY LOG: Potential account takeover or confusion
    logger.warn(
      `Signup attempt failed: Email already exists - ${userData.email}`,
    );

    if (existingUser.googleId && !existingUser.password) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This email is linked to a Google account. Please log in with Google or reset your password to add manual login.",
      );
    }
    throw new AppError(httpStatus.BAD_REQUEST, "Email already in use");
  }

  const newUser = await User.create(userData);

  // AUDIT LOG: Track new user growth
  logger.info(`User created successfully: ${newUser._id} - ${newUser.email}`);

  return newUser;
};

export const verifyUser = async (
  email: string,
  password: string,
): Promise<IUser> => {
  const user = await User.findOne({ email }).select("+password +googleId");

  if (!user) {
    logger.warn(`Login failed: User not found - ${email}`);
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }

  if (!user.password && user.googleId) {
    logger.info(
      `Login redirect: User ${email} attempted manual login on Google-only account`,
    );
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account was created via Google. Please log in with Google.",
    );
  }

  if (
    !user.password ||
    !(await user.correctPassword(password, user.password))
  ) {
    // SECURITY LOG: Invalid password attempts
    logger.warn(`Login failed: Incorrect password for ${email}`);
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }

  if (user.status === "suspended") {
    logger.warn(`Login rejected: Account is suspended - ${user._id}`);
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. Please contact customer support.",
    );
  }
  logger.info(`User logged in: ${user._id}`);
  return user;
};

export const getAuthenticatedUser = async (userId: string) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    // SYSTEM LOG: This is an error because the ID came from a verified token
    logger.error(
      `Authenticated user check failed: User ID ${userId} no longer exists`,
    );
    throw new Error("User not found");
  }

  return user;
};

export const logoutUser = async (userId?: string) => {
  // AUDIT LOG: Useful for debugging session/cookie clearing issues
  logger.info(`User session terminated: ${userId || "unknown"}`);
  return { success: true };
};
