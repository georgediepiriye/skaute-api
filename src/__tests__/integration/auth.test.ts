import request from "supertest";
import { createFakeUserForSignup } from "../fixtures/user.fixture.js";
import { User } from "../../models/User.js";
import app from "../../app.js";
import setupTestDB from "../utils/setupTestDB.js";

setupTestDB();

describe("Auth Routes", () => {
  // 2. Cleanup: Clear the User collection after every single test
  afterEach(async () => {
    await User.deleteMany({});
  });

  describe("POST /v1/auth/signup", () => {
    it("should successfully register a new user and return a token", async () => {
      const newUser = createFakeUserForSignup("user", {
        name: "George Diepiriye",
        email: "george@scaute.app",
      });

      const res = await request(app).post("/v1/auth/signup").send(newUser);

      // Assertions
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body).toHaveProperty("token");
      expect(res.body.data.user.email).toBe("george@scaute.app");

      // Verify the password is NOT returned in the response
      expect(res.body.data.user.password).toBeUndefined();

      // Verify the user actually exists in the database
      const userInDb = await User.findOne({ email: "george@scaute.app" });
      expect(userInDb).toBeTruthy();
      expect(userInDb?.name).toBe("George Diepiriye");
    });

    it("should fail if the email is already registered", async () => {
      const existingUser = createFakeUserForSignup("user", {
        email: "duplicate@scaute.app",
      });

      // Manually create the first user in the DB
      await User.create(existingUser);

      // Attempt to signup with the same email
      const res = await request(app).post("/v1/auth/signup").send(existingUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email already in use/i);
    });

    it("should default to Port Harcourt coordinates if none are provided", async () => {
      const userWithoutLocation = {
        name: "PH Boy",
        email: "ph@scaute.app",
        password: "password123",
        passwordConfirm: "password123",
      };

      const res = await request(app)
        .post("/v1/auth/signup")
        .send(userWithoutLocation);

      expect(res.status).toBe(201);
      // Checking your schema's default [7.0085, 4.8156]
      expect(res.body.data.user.location.coordinates).toEqual([7.0085, 4.8156]);
    });
  });

  describe("POST /v1/auth/login", () => {
    it("should login an existing user and return a token", async () => {
      // 1. Create a user manually
      const password = "password123";
      await User.create({
        name: "Login Tester",
        email: "test@scaute.app",
        password,
        role: "organizer",
      });

      // 2. Attempt login
      const res = await request(app).post("/v1/auth/login").send({
        email: "test@scaute.app",
        password: password,
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body).toHaveProperty("token");
      expect(res.body.data.user.role).toBe("organizer");
    });

    it("should reject incorrect passwords", async () => {
      await User.create({
        name: "Security Test",
        email: "secure@scaute.app",
        password: "realpassword",
      });

      const res = await request(app).post("/v1/auth/login").send({
        email: "secure@scaute.app",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/incorrect email or password/i);
    });
  });
});
