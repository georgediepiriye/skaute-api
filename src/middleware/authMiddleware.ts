import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import AppError from "../utils/AppError.js";
import httpStatus from "http-status";
import config from "../config/config.js";
import logger from "../utils/logger.js";

interface JwtPayload {
  id: string;
  iat: number;
}

export const protect = (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    // 1. Check Cookies
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Bulletproof Authorization Header Check
    else if (req.headers.authorization) {
      // Matches 'Bearer ' or 'Bearer' followed by any amount of whitespace
      const authHeader = req.headers.authorization;
      if (/^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, "").trim();
      }
    }

    if (!token || token === "null" || token === "undefined") {
      logger.debug(
        `Protect Middleware: Missing token validation for ${req.originalUrl}`,
      );
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in. Please log in to get access.",
      });
    }

    // 3. Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // 4. Check user
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
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

export const optionalProtect = (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const currentUser = await User.findById(decoded.id);

    if (currentUser) {
      (req as any).user = currentUser;
    }

    next();
  } catch (error: any) {
    next();
  }
}) as RequestHandler;

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
