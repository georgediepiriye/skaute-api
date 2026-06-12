import request from "supertest";
import app from "../../app.js";
import HotspotSuggestion from "../../models/HotspotSuggestion.js";
import setupTestDB from "../utils/setupTestDB.js";

setupTestDB();

describe("Rate limiting", () => {
  it("blocks repeated failed login attempts from the same IP", async () => {
    const ip = "198.51.100.20";

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const res = await request(app)
        .post("/v1/auth/login")
        .set("X-Forwarded-For", ip)
        .send({
          email: "missing-user@skaute.test",
          password: "wrong-password",
        });

      expect(res.status).toBe(401);
    }

    const limitedRes = await request(app)
      .post("/v1/auth/login")
      .set("X-Forwarded-For", ip)
      .send({
        email: "missing-user@skaute.test",
        password: "wrong-password",
      });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body).toEqual({
      status: "error",
      message: "Too many login attempts. Try again later.",
    });
  });

  it("blocks repeated public hotspot suggestions from the same IP", async () => {
    const ip = "198.51.100.21";

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const res = await request(app)
        .post("/v1/hotspots/suggestions")
        .set("X-Forwarded-For", ip)
        .send({
          title: `Suggestion ${attempt}`,
          category: "lounge",
          location: {
            neighborhood: "GRA",
          },
        });

      expect(res.status).toBe(201);
    }

    const limitedRes = await request(app)
      .post("/v1/hotspots/suggestions")
      .set("X-Forwarded-For", ip)
      .send({
        title: "Suggestion 9",
        category: "lounge",
        location: {
          neighborhood: "GRA",
        },
      });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body).toEqual({
      status: "error",
      message: "Too many hotspot update suggestions. Try again later.",
    });
    expect(await HotspotSuggestion.countDocuments()).toBe(8);
  });
});
