import request from "supertest";
import app from "../../app.js";
import Hotspot from "../../models/Hotspot.js";
import HotspotSuggestion from "../../models/HotspotSuggestion.js";
import setupTestDB from "../utils/setupTestDB.js";
import { createUserAndToken } from "../utils/authTestUtils.js";

setupTestDB();

const validSuggestionPayload = {
  title: "The Wine Lab",
  category: "lounge",
  location: {
    address: "12 Example Street",
    neighborhood: "GRA",
    city: "Port Harcourt",
    state: "Rivers State",
    coordinates: [7.012345, 4.812345],
  },
  contact: {
    phone: "08030000000",
    website: "https://winelab.example.com",
    instagram: "@winelab",
  },
  note: "Nice rooftop spot, best in the evening.",
  suggestedBy: {
    name: "George",
    email: "george@example.com",
  },
};

describe("Hotspot suggestion flow", () => {
  describe("POST /v1/hotspots/suggestions", () => {
    it("accepts a public JSON suggestion without description, image, or coordinates", async () => {
      const res = await request(app)
        .post("/v1/hotspots/suggestions")
        .set("X-Forwarded-For", "203.0.113.10")
        .send({
          title: "Garden Social",
          category: "others",
          location: {
            neighborhood: "D-Line",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Hotspot suggestion submitted for review");
      expect(res.body.data.suggestion.status).toBe("pending");
      expect(res.body.data.suggestion.category).toBe("other");
      expect(res.body.data.suggestion.image).toBeUndefined();

      const suggestion = await HotspotSuggestion.findOne({
        title: "Garden Social",
      });
      expect(suggestion).toBeTruthy();
      expect(suggestion?.location.neighborhood).toBe("D-Line");
    });

    it("rejects suggestions that have no address, neighborhood, or coordinates", async () => {
      const res = await request(app)
        .post("/v1/hotspots/suggestions")
        .set("X-Forwarded-For", "203.0.113.11")
        .send({
          title: "No Pin Spot",
          category: "lounge",
          location: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
      expect(res.body.message).toMatch(/address, neighborhood, or map coordinates/i);
      expect(await HotspotSuggestion.countDocuments()).toBe(0);
    });

    it("attaches the user id when a valid optional token is sent", async () => {
      const { user, token } = await createUserAndToken("user", {
        email: "suggestor@skaute.test",
      });

      const res = await request(app)
        .post("/v1/hotspots/suggestions")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Forwarded-For", "203.0.113.12")
        .send(validSuggestionPayload);

      expect(res.status).toBe(201);

      const suggestion = await HotspotSuggestion.findOne({
        title: "The Wine Lab",
      });
      expect(suggestion?.suggestedBy?.userId?.toString()).toBe(
        user._id.toString(),
      );
    });

    it("accepts multipart suggestionData without requiring an image", async () => {
      const res = await request(app)
        .post("/v1/hotspots/suggestions")
        .set("X-Forwarded-For", "203.0.113.13")
        .field("suggestionData", JSON.stringify(validSuggestionPayload));

      expect(res.status).toBe(201);
      expect(res.body.data.suggestion.title).toBe("The Wine Lab");
      expect(res.body.data.suggestion.image).toBeUndefined();
    });
  });

  describe("Admin suggestion review", () => {
    it("requires admin auth for the queue", async () => {
      const res = await request(app).get("/v1/admin/hotspot-suggestions");

      expect(res.status).toBe(401);
    });

    it("lists suggestions with pagination and search", async () => {
      const { token } = await createUserAndToken("admin", {
        email: "admin-list@skaute.test",
      });
      await HotspotSuggestion.create([
        validSuggestionPayload,
        {
          ...validSuggestionPayload,
          title: "Quiet Workspace",
          category: "workspace",
          location: { neighborhood: "Woji" },
        },
      ]);

      const res = await request(app)
        .get("/v1/admin/hotspot-suggestions?search=wine&page=1&limit=10")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Forwarded-For", "203.0.113.14");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.suggestions).toHaveLength(1);
      expect(res.body.data.suggestions[0].title).toBe("The Wine Lab");
      expect(res.body.data.pagination.total).toBe(1);
      expect(res.body.data.pagination.pages).toBe(1);
    });

    it("approves a suggestion into a hidden unverified hotspot with safe defaults", async () => {
      const { token } = await createUserAndToken("admin", {
        email: "admin-approve@skaute.test",
      });
      const suggestion = await HotspotSuggestion.create(validSuggestionPayload);

      const res = await request(app)
        .post(`/v1/admin/hotspot-suggestions/${suggestion._id}/approve`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Forwarded-For", "203.0.113.15");

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Suggestion approved and hotspot created");
      expect(res.body.data.suggestion.status).toBe("approved");
      expect(res.body.data.hotspot.title).toBe("The Wine Lab");
      expect(res.body.data.hotspot.isActive).toBe(false);
      expect(res.body.data.hotspot.isVerified).toBe(false);
      expect(res.body.data.hotspot.location.coordinates).toEqual([
        7.012345, 4.812345,
      ]);

      const hotspot = await Hotspot.findById(res.body.data.hotspot._id);
      const updatedSuggestion = await HotspotSuggestion.findById(suggestion._id);
      expect(hotspot).toBeTruthy();
      expect(updatedSuggestion?.createdHotspotId?.toString()).toBe(
        hotspot?._id.toString(),
      );
    });

    it("rejects a suggestion with admin notes", async () => {
      const { token } = await createUserAndToken("admin", {
        email: "admin-reject@skaute.test",
      });
      const suggestion = await HotspotSuggestion.create(validSuggestionPayload);

      const res = await request(app)
        .post(`/v1/admin/hotspot-suggestions/${suggestion._id}/reject`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Forwarded-For", "203.0.113.16")
        .send({ adminNotes: "Could not verify this place." });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Suggestion rejected");
      expect(res.body.data.suggestion.status).toBe("rejected");
      expect(res.body.data.suggestion.adminNotes).toBe(
        "Could not verify this place.",
      );
    });
  });
});
