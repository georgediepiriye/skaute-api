import request from "supertest";
import app from "../../app.js";
import { User } from "../../models/User.js";

type TestUserRole = "user" | "organizer" | "admin";

export const createUserAndToken = async (
  role: TestUserRole = "user",
  overrides: Record<string, unknown> = {},
) => {
  const email =
    (overrides.email as string | undefined) ||
    `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@skaute.test`;
  const password = (overrides.password as string | undefined) || "password123";

  const user = await User.create({
    name: `${role} Tester`,
    email,
    password,
    role,
    ...overrides,
  });

  const loginRes = await request(app)
    .post("/v1/auth/login")
    .set("X-Forwarded-For", `10.10.${Math.floor(Math.random() * 200)}.1`)
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(
      `Could not create ${role} auth token: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }

  return { user, token: loginRes.body.token as string };
};
