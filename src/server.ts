import app from "./app.js";
import { connectDB } from "./config/db.js";
import config from "./config/config.js";
import { Server } from "http";
import { initInventoryCron } from "./utils/cronJobs.js";

let server: Server;

/**
 * BOOTSTRAP FUNCTION
 */
const bootstrap = async () => {
  try {
    console.log("⏳ Initializing Skaute API startup...");

    // 1. Wait for Database
    await connectDB();

    // Start the background worker
    initInventoryCron();
    // 2. Start Server only if DB is successful
    server = app.listen(config.port, () => {
      console.log(
        `🚀 skaute API running on port ${config.port} in ${config.env} mode`,
      );
    });
  } catch (err) {
    // LOG THE ERROR TO CONSOLE
    console.error("❌ STARTUP ERROR:");
    console.error(err);

    // Kill the process so it doesn't stay in a "zombie" state
    process.exit(1);
  }
};

bootstrap();

/**
 * GLOBAL PROCESS HANDLERS
 */
process.on("unhandledRejection", (err: Error) => {
  console.error("💥 UNHANDLED REJECTION! Shutting down...");
  console.error(err); // Log the full error stack

  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
