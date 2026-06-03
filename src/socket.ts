import { Server } from "socket.io";
import Hotspot from "./models/Hotspot.js";

let io: Server;

export const initSocket = (httpServer: any) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Handle joining a hotspot room
    socket.on("join-hotspot", async (hotspotId: string) => {
      socket.join(`hotspot:${hotspotId}`);
      console.log(`Socket ${socket.id} joined hotspot:${hotspotId}`);

      try {
        // Fetch the current snapshot of the hotspot to give the user an immediate state sync
        const hotspot = await Hotspot.findById(hotspotId);

        if (hotspot) {
          // Convert to object and ensure virtual fields are evaluated
          const hotspotData = hotspot.toObject({ virtuals: true });

          // Send data strictly to the single socket that just connected
          socket.emit("hotspot-vibe-initial", {
            hotspotId,
            vibeCheck: hotspotData.vibeCheck,
            energyScore: hotspotData.energyScore,
            vibeScore: hotspotData.vibeScore,
            heatIntensity: hotspotData.heatIntensity,
            vibeFreshness: hotspotData.vibeFreshness,
            computedAuraRadius: hotspotData.computedAuraRadius,
          });
        }
      } catch (err) {
        console.error(
          `❌ Error fetching initial vibe state for room ${hotspotId}:`,
          err,
        );
        // Optional: Emit an error event back to the client if needed
        socket.emit("error", { message: "Failed to load initial vibe data." });
      }
    });

    // Handle leaving a hotspot room
    socket.on("leave-hotspot", (hotspotId: string) => {
      socket.leave(`hotspot:${hotspotId}`);
      console.log(`Socket ${socket.id} left hotspot:${hotspotId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }

  return io;
};
