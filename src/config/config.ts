import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// --- ESM __dirname Fix ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the root directory
dotenv.config({ path: path.join(__dirname, "../../.env") });

const envVarsSchema = z
  .object({
    NODE_ENV: z
      .enum(["production", "development", "staging", "test"])
      .default("development"),
    PORT: z
      .string()
      .default("5000")
      .transform((num) => Number(num)),

    // Auth & Security
    JWT_SECRET: z.string().min(32).describe("JWT secret key"),
    JWT_ACCESS_EXPIRATION_MINUTES: z
      .string()
      .default("30")
      .transform((num) => Number(num)),
    JWT_REFRESH_EXPIRATION_DAYS: z.string().default("30"),

    // Databases
    DATABASE_URL: z.string().optional().describe("Production DB URL"),
    DEV_DATABASE_URL: z.string().optional().describe("Development DB URL"),
    STAGING_DATABASE_URL: z.string().optional().describe("Staging DB URL"),

    // Payments & Services (skaute Core)
    PAYSTACK_SECRET_KEY: z.string().describe("Paystack secret KEY"),
    PAYSTACK_BASE_API: z.string().url().describe("Paystack base API URL"),

    // Infrastructure
    REDIS_PUBLIC_URL: z.string().describe("Redis public url"),
    CLIENT_ORIGIN: z.string().url().describe("Frontend client URL"),
    CLIENT_ORIGIN_WWW: z
      .string()
      .url()
      .describe("Frontend client URL with www prefix"),
    API_URL: z.string().url().describe("Public API URL"),

    // Third-party APIs
    SENDGRID_API_KEY: z.string().describe("SendGrid API key"),
    SENTRY_DSN: z.string().url().describe("Sentry error tracking"),
    RESEND_API_KEY: z
      .string()
      .describe("Resend API key for transactional emails"),
    GOOGLE_CLIENT_ID: z.string().describe("Google OAuth Client ID"),
    GOOGLE_CLIENT_SECRET: z.string().describe("Google OAuth Client Secret"),
    CLOUDINARY_CLOUD_NAME: z.string().describe("Cloudinary cloud name"),
    CLOUDINARY_API_KEY: z.string().describe("Cloudinary API key"),
    CLOUDINARY_API_SECRET: z.string().describe("Cloudinary API secret"),

    // Logic/Taxation
    SKAUTE_FEE_PERCENT: z
      .string()
      .default("0.05")
      .transform((num) => Number(num)),
  })
  .superRefine((data, ctx) => {
    if (
      (data.NODE_ENV === "development" || data.NODE_ENV === "test") &&
      !data.DEV_DATABASE_URL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DEV_DATABASE_URL is required when NODE_ENV is development or test",
        path: ["DEV_DATABASE_URL"],
      });
    }
    if (data.NODE_ENV === "production" && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required for production",
        path: ["DATABASE_URL"],
      });
    }
  });

// Validate process.env
let envVars;
try {
  envVars = envVarsSchema.parse(process.env);
} catch (err: any) {
  // We format the Zod issues into a readable string
  const issues = err.issues
    .map((i: any) => `[${i.path.join(".")}] ${i.message}`)
    .join("\n   ");

  const errorMessage = `\n❌ Invalid Environment Variables:\n   ${issues}\n`;

  // LOG IT: So it shows in the console
  console.error(errorMessage);

  // THROW IT: So GitHub Actions captures the specific missing keys in the error summary
  throw new Error(errorMessage);
}

// Exported structured object
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  db: {
    url:
      envVars.NODE_ENV === "production"
        ? envVars.DATABASE_URL
        : envVars.NODE_ENV === "staging"
          ? envVars.STAGING_DATABASE_URL
          : envVars.DEV_DATABASE_URL,
  },
  payments: {
    paystackSecret: envVars.PAYSTACK_SECRET_KEY,
    paystackBaseApi: envVars.PAYSTACK_BASE_API,
  },
  redisUrl: envVars.REDIS_PUBLIC_URL,
  clientUrl: envVars.CLIENT_ORIGIN,
  clientUrlWWW: envVars.CLIENT_ORIGIN_WWW,
  apiUrl: envVars.API_URL,
  sendGridApiKey: envVars.SENDGRID_API_KEY,
  skauteFeePercent: envVars.SKAUTE_FEE_PERCENT,
  sentryDsn: envVars.SENTRY_DSN,
  resendApiKey: envVars.RESEND_API_KEY,
  googleOAuth: {
    clientId: envVars.GOOGLE_CLIENT_ID,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET,
  },
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
  },
} as const;

export default config;
