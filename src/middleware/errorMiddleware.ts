import { Request, Response, NextFunction } from "express";
import config from "../config/config.js";
import logger from "../utils/logger.js";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = err.statusCode || 500;
  let status = err.status || "error";
  let message = err.message || "An unexpected error occurred.";

  // 1. LOG THE ERROR (Keep technical data strictly in server files)
  if (statusCode >= 500) {
    logger.error(
      `SYSTEM ERROR: [${req.method}] ${req.originalUrl} | Status: ${statusCode} | Message: ${message} | Stack: ${err.stack}`,
    );
  } else {
    logger.warn(
      `OPERATIONAL ERROR: [${req.method}] ${req.originalUrl} | Status: ${statusCode} | Message: ${message}`,
    );
  }

  // 2. HUMANIZING CLEANUP MACHINE

  // A. Handling Mongoose/MongoDB Duplicate Key Errors (E11000)
  if (err.code === 11000 || err.message?.includes("E11000")) {
    statusCode = 400;
    status = "fail";

    let friendlyField = "This information";

    // Safely extract the duplicate field name across standard and bulk write objects
    if (err.keyValue && typeof err.keyValue === "object") {
      const keys = Object.keys(err.keyValue);
      if (keys.length > 0) friendlyField = keys[0];
    } else if (err.message) {
      // Fallback: Parse the field out of the native driver string if keyValue wrapper is missing
      const match = err.message.match(/index:\s+([a-zA-Z0-9_]+)_\d+/);
      if (match && match[1]) friendlyField = match[1];
    }

    // Map structural database collection properties to smooth display labels
    if (friendlyField.toLowerCase().includes("email")) {
      message =
        "This email address is already registered with an active account.";
    } else if (
      friendlyField.toLowerCase().includes("slug") ||
      friendlyField.toLowerCase().includes("link")
    ) {
      message =
        "This custom event link is already taken. Try making it a little more unique!";
    } else if (
      friendlyField.toLowerCase().includes("qrcode") ||
      friendlyField.toLowerCase().includes("checkin")
    ) {
      message =
        "A generation ticket processing collision occurred. Please re-submit your checkout form.";
    } else {
      // Capitalize standard property variations
      const cleanLabel =
        friendlyField.charAt(0).toUpperCase() + friendlyField.slice(1);
      message = `${cleanLabel} is already in use by another move or account.`;
    }
  }

  // B. Handling Mongoose Data / Validation Constraints
  else if (err.name === "ValidationError" || err.errors) {
    statusCode = 400;
    status = "fail";

    if (err.errors && typeof err.errors === "object") {
      message = Object.values(err.errors)
        .map((el: any) => {
          if (!el) return "Invalid input format.";
          let rawMessage = el.message || "Invalid input value.";

          // Strip away schema property structural namespaces (e.g. "body.email")
          rawMessage = rawMessage.replace(
            /^(body\.|coOrganizers\.\d+\.|event\.|staff\.\d+\.)/gi,
            "",
          );

          // Strip duplicated sequential naming phrases
          const words = rawMessage.split(" ");
          if (
            words.length > 1 &&
            words[0].toLowerCase() === words[1].toLowerCase()
          ) {
            words.shift();
          }
          rawMessage = words.join(" ");

          // Direct UI-friendly validation replacements
          if (rawMessage.toLowerCase().includes("cannot be completely empty")) {
            return "Team partners must have at least one valid operational permission flag active.";
          }
          if (
            rawMessage.toLowerCase().includes("is required") ||
            rawMessage.toLowerCase().includes("cannot be blank")
          ) {
            const fieldPath = el.path
              ? el.path.charAt(0).toUpperCase() + el.path.slice(1)
              : "This field";
            return `${fieldPath} cannot be left blank.`;
          }

          return rawMessage.charAt(0).toUpperCase() + rawMessage.slice(1);
        })
        .join(" ");
    } else {
      message =
        "Your submission forms contain empty or unparseable text fields.";
    }
  }

  // C. Handling Broken JWT Authentications safely
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    status = "fail";
    message =
      "Your login session is invalid. Please log back into your profile account.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    status = "fail";
    message =
      "Your login authentication window has timed out. Please sign in again.";
  }

  // 3. SEND STRIPPED RESPONSES TO FRONTEND
  if (config.env === "development") {
    return res.status(statusCode).json({
      status,
      message,
      stack: err.stack,
      error: err,
    });
  }

  // PRODUCTION STRATEGY
  // If it's a known operational exception or client input issue (4xx), pass the humanized message
  if (err.isOperational || statusCode < 500) {
    return res.status(statusCode).json({ status, message });
  }

  // Pure fallback guard for complete system code drops (500) - absolute secrecy maintained
  return res.status(500).json({
    status: "error",
    message:
      "Something went slightly wrong on our end! Our engineers are already looking into it.",
  });
};
