import app from "./app.js";
import { connectDB } from "./config/db.js";
import config from "./config/config.js";
import { Server } from "http";
import { initInventoryCron, initVibeDecayCron } from "./utils/cronJobs.js";
import { initSocket } from "./socket.js";

let server: Server;

const bootstrap = async () => {
  try {
    console.log("⏳ Initializing Skaute API startup...");

    // 1. Connect to MongoDB
    await connectDB();

    // 2. Fire up background workers/crons
    initInventoryCron();
    initVibeDecayCron();

    // 3. Spin up the HTTP Server instance
    server = app.listen(config.port, () => {
      console.log(
        `🚀 skaute API running on port ${config.port} in ${config.env} mode`,
      );
    });

    // 4. Attach Socket.io server to the HTTP instance
    initSocket(server);
  } catch (err) {
    console.error("❌ STARTUP ERROR:");
    console.error(err);

    process.exit(1);
  }
};

bootstrap();

process.on("unhandledRejection", (err: Error) => {
  console.error("💥 UNHANDLED REJECTION! Shutting down...");
  console.error(err);

  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
