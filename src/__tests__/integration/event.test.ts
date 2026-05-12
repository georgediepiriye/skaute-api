import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { User } from "../../models/User.js";
import { Event } from "../../models/Event.js";
import setupTestDB from "../utils/setupTestDB.js";
import status from "http-status";

setupTestDB();

describe("Event Routes", () => {
  let organizerToken: string;
  let userId: string;

  beforeEach(async () => {
    await Event.deleteMany({});
    await User.deleteMany({});

    // Create a mock organizer to get a token
    const organizer = await User.create({
      name: "PH Organizer",
      email: "organizer@kivo.app",
      password: "password123",
      role: "organizer",
    });
    userId = organizer._id.toString();

    // Login to get the token
    const loginRes = await request(app).post("/v1/auth/login").send({
      email: "organizer@kivo.app",
      password: "password123",
    });
    organizerToken = loginRes.body.token;
  });

  describe("POST /v1/events", () => {
    beforeEach(async () => {
      await Event.deleteMany({});
    });
    const validEvent = {
      title: "Kivo Rooftop Vibe",
      slug: "kivo-rooftop-vibe",
      description:
        "Networking and chilled vibes in the heart of Port Harcourt. Come through!",
      eventFormat: "physical",
      type: "activity",
      status: "casual",
      category: "party",
      startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: {
        type: "Point",
        coordinates: [7.0085, 4.8156],
        address: "GRA Phase 2, Port Harcourt",
      },
    };

    it("should allow an organizer to broadcast a move", async () => {
      const res = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send(validEvent);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.event.title).toBe("Kivo Rooftop Vibe");
      expect(res.body.data.event.organizer).toBe(userId);
    });

    it("should fail if location is missing for a physical event (Zod Refinement)", async () => {
      const invalidEvent = { ...validEvent, location: null };

      const res = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send(invalidEvent);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/location is required/i);
    });

    // it("should fail if a regular 'user' tries to broadcast", async () => {
    //   // Create a standard user
    //   await User.create({
    //     name: "Regular Joe",
    //     email: "joe@kivo.app",
    //     password: "password123",
    //     role: "user",
    //   });

    //   const loginRes = await request(app).post("/v1/auth/login").send({
    //     email: "joe@kivo.app",
    //     password: "password123",
    //   });

    //   const res = await request(app)
    //     .post("/v1/events")
    //     .set("Authorization", `Bearer ${loginRes.body.token}`)
    //     .send(validEvent);

    //   expect(res.status).toBe(403);
    //   expect(res.body.message).toMatch(/do not have permission/i);
    // });
  });

  describe("GET /v1/events", () => {
    it("should fetch all upcoming moves", async () => {
      // Create a mock event in DB
      await Event.create({
        title: "Upcoming Move",
        slug: "upcoming-move",
        description: "Testing the list view of the events route.",
        eventFormat: "physical",
        type: "activity",
        status: "casual",
        category: "party",
        approvalStatus: "approved",
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        organizer: new mongoose.Types.ObjectId(),
        location: {
          type: "Point",
          coordinates: [7.0085, 4.8156], // Port Harcourt
          address: "GRA Phase 2, Port Harcourt",
        },
        // --- Ticketing Logic ---
        ticketingType: "internal",
        ticketTiers: [
          {
            name: "Big Boy",
            price: 4000,
            capacity: 500,
            sold: 0,
            salesEnd: new Date(Date.now() + 86400000),
          },
        ],
        totalCapacity: 500,
        ticketsSold: 0,

        communityLink: "https://chat.whatsapp.com/KivoTest",
        meetingLink: "https://zoom.us/j/123",
      });

      const res = await request(app).get("/v1/events");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBe(1);
    });
  });
});
