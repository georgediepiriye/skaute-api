import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import logger from "./utils/logger.js";
import { globalErrorHandler } from "./middleware/errorMiddleware.js";
import authRouter from "./routes/authRoutes.js";
import eventRouter from "./routes/eventRoutes.js";
import hotspotRouter from "./routes/hotspotRoutes.js";
import ticketRouter from "./routes/ticketRoutes.js";
import userRouter from "./routes/userRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import httpStatus from "http-status";
import AppError from "./utils/AppError.js";
import * as webhookController from "./controllers/webhookController.js";
import cookieParser from "cookie-parser";
import config from "./config/config.js";
import passport from "passport";
import "./config/passport.js";

const app = express();

app.enable("trust proxy");

/**
 * LOGGING MIDDLEWARE (Morgan + Winston)
 */
const stream = {
  write: (message: string) => logger.http(message.trim()),
};

// Use 'combined' for production (includes IP/User Agent), 'dev' for local
app.use(morgan(config.env === "production" ? "combined" : "dev", { stream }));

app.use(helmet());
app.use(cookieParser());

const corsOptions = {
  origin: config.clientUrl,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options(/^\/.*$/, cors(corsOptions));

app.use(passport.initialize());

/**
 * 1. PAYSTACK WEBHOOK
 */
app.post(
  "/v1/webhooks/paystack",
  express.raw({ type: "application/json" }),
  webhookController.handlePaystackWebhook,
);

/**
 * 2. BODY PARSERS
 */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

/**
 * API ROUTES
 */
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Kivo API is up and running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/v1/auth", authRouter);
app.use("/v1/events", eventRouter);
app.use("/v1/hotspots", hotspotRouter);
app.use("/v1/tickets", ticketRouter);
app.use("/v1/users", userRouter);
app.use("/v1/admin", adminRouter);

app.all(/^\/.*$/, (_, __, next) => {
  next(
    new AppError(httpStatus.NOT_FOUND, "The requested resource was not found."),
  );
});

app.use(globalErrorHandler);

export default app;
