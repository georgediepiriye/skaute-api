process.env.NODE_ENV = "test";
process.env.MONGOMS_IP = process.env.MONGOMS_IP || "127.0.0.1";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-with-at-least-thirty-two-chars";
process.env.JWT_ACCESS_EXPIRATION_MINUTES =
  process.env.JWT_ACCESS_EXPIRATION_MINUTES || "30";
process.env.JWT_REFRESH_EXPIRATION_DAYS =
  process.env.JWT_REFRESH_EXPIRATION_DAYS || "30";
process.env.DEV_DATABASE_URL =
  process.env.DEV_DATABASE_URL || "mongodb://127.0.0.1:27017/skaute-test";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "sk_test_skaute";
process.env.PAYSTACK_BASE_API =
  process.env.PAYSTACK_BASE_API || "https://api.paystack.co";
process.env.REDIS_PUBLIC_URL =
  process.env.REDIS_PUBLIC_URL || "redis://127.0.0.1:6379";
process.env.CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:3000";
process.env.CLIENT_ORIGIN_WWW =
  process.env.CLIENT_ORIGIN_WWW || "http://www.localhost:3000";
process.env.API_URL = process.env.API_URL || "http://localhost:5000";
process.env.SENDGRID_API_KEY =
  process.env.SENDGRID_API_KEY || "test-sendgrid-key";
process.env.SENTRY_DSN =
  process.env.SENTRY_DSN || "https://examplePublicKey@example.com/1";
process.env.RESEND_API_KEY =
  process.env.RESEND_API_KEY || "re_test_skaute";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "google-client-secret";
process.env.CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY || "test-cloudinary-key";
process.env.CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET || "test-cloudinary-secret";
