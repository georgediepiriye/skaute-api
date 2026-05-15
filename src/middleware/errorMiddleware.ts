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
  let message = err.message;

  // 1. LOG THE ERROR (The Winston Way) - Keep technical details in server logs
  if (statusCode >= 500) {
    logger.error(
      `SYSTEM ERROR: [${req.method}] ${req.originalUrl} | Status: ${statusCode} | Message: ${message} | Stack: ${err.stack}`,
    );
  } else {
    logger.warn(
      `OPERATIONAL ERROR: [${req.method}] ${req.originalUrl} | Status: ${statusCode} | Message: ${message}`,
    );
  }

  // 2. SPECIALIZED HUMANIZING ERROR CLEANUP

  // Handling Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    status = "fail";
    const field = Object.keys(err.keyValue)[0];

    // Non-technical field mapping transitions
    let friendlyField = field.charAt(0).toUpperCase() + field.slice(1);
    if (friendlyField.toLowerCase() === "email")
      friendlyField = "This email address";
    if (friendlyField.toLowerCase() === "slug")
      friendlyField = "This event link";

    message = `${friendlyField} is already being used by another account or move.`;
  }

  // Handling Mongoose / Zod Validation Errors
  if (err.name === "ValidationError" || err.errors) {
    statusCode = 400;
    status = "fail";

    message = Object.values(err.errors || {})
      .map((el: any) => {
        let rawMessage = el.message || "Invalid input value.";

        // Clean up structural prefix naming mechanics (e.g., "body.email", "coOrganizers.0.permissions")
        rawMessage = rawMessage.replace(
          /^(body\.|coOrganizers\.\d+\.|event\.)/gi,
          "",
        );

        // Fix the double word repetition anomaly (e.g., "Permissions Permissions array...")
        const words = rawMessage.split(" ");
        if (
          words.length > 1 &&
          words[0].toLowerCase() === words[1].toLowerCase()
        ) {
          words.shift(); // Remove the duplicate word prefix tracking
        }
        rawMessage = words.join(" ");

        // Enforce smooth, friendly, non-technical translations for known constraints
        if (rawMessage.toLowerCase().includes("cannot be completely empty")) {
          return "Partners must have at least one permission option selected.";
        }
        if (rawMessage.toLowerCase().includes("is required")) {
          return `${el.path ? el.path.charAt(0).toUpperCase() + el.path.slice(1) : "This field"} cannot be left blank.`;
        }

        // Standard text casing sanitization
        return rawMessage.charAt(0).toUpperCase() + rawMessage.slice(1);
      })
      .join(" ");
  }

  // 3. SEND RESPONSE
  if (config.env === "development") {
    return res.status(statusCode).json({
      status,
      message,
      stack: err.stack,
      error: err,
    });
  }

  // PRODUCTION: Deliver streamlined friendly strings
  if (err.isOperational || statusCode < 500) {
    return res.status(statusCode).json({ status, message });
  }

  // Final fallback text for unexpected crashes
  return res.status(500).json({
    status: "error",
    message:
      "Something went slightly wrong on our end! We are looking into it.",
  });
};
