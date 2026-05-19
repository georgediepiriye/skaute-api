import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import AppError from "../utils/AppError.js";
import httpStatus from "http-status";
import config from "../config/config.js";
import logger from "../utils/logger.js";

/**
 * Shared internal helper to reliably parse tokens from cookies or authorization headers
 */
const extractToken = (req: Request): string | undefined => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (/^Bearer\s+/i.test(authHeader)) {
      const sanitizedToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (
        sanitizedToken !== "null" &&
        sanitizedToken !== "undefined" &&
        sanitizedToken !== ""
      ) {
        return sanitizedToken;
      }
    }
  }

  return undefined;
};

export const protect = (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      logger.debug(
        `Protect Middleware: Missing token validation for ${req.originalUrl}`,
      );
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in. Please log in to get access.",
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
      });
    }

    // 🛑 ACTIVE RUNTIME GUARD: Stop suspended users from hitting your application controllers
    if (currentUser.status === "suspended") {
      logger.warn(
        `Protected access blocked: Suspended user token detected - ${currentUser._id}`,
      );
      return res.status(403).json({
        status: "fail",
        message: "Your account has been suspended. Access denied.",
      });
    }

    (req as any).user = currentUser;
    next();
  } catch (error: any) {
    logger.warn(`JWT Verification Failed: ${error.message}`);
    return res.status(401).json({
      status: "fail",
      message: "Invalid token or session expired.",
    });
  }
}) as RequestHandler;

/**
 * Optional Protection Middleware - Decodes identity if it exists, otherwise falls back to guest mode gracefully
 */
export const optionalProtect = (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = extractToken(req);

  // If there is zero authentication present, pass through immediately as a safe guest session
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const currentUser = await User.findById(decoded.id);

    if (currentUser && currentUser.status !== "suspended") {
      (req as any).user = currentUser;
    }

    next();
  } catch (error: any) {
    // 💡 If a token was intentionally provided but is explicitly broken or expired,
    // we alert the client instead of masking it as a guest request.
    logger.warn(
      `Optional Protect Middleware - Token provided but invalid: ${error.message}`,
    );

    return res.status(401).json({
      status: "fail",
      message:
        "Your session token is invalid or expired. Please sign in again or clear your session.",
    });
  }
}) as RequestHandler;

/**
 * Role RBAC Authorization Enforcement Layer
 */
export const restrictTo = (...roles: string[]) => {
  return ((req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as IUser | undefined;

    if (!user || !roles.includes(user.role)) {
      logger.warn(
        `Forbidden Access Attempt: User ${user?._id || "Anonymous"} tried to access ${req.originalUrl} - Required Roles: [${roles}]`,
      );
      return next(
        new AppError(
          httpStatus.FORBIDDEN,
          "You do not have permission to perform this action",
        ),
      );
    }
    next();
  }) as RequestHandler;
};
