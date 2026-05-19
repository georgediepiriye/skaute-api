import { faker } from "@faker-js/faker";
import mongoose from "mongoose";

// The 3 Specific skaute Roles
export type UserRole = "user" | "organizer" | "admin";

/**
 * Generates a mock user object based on your skaute Mongoose Schema.
 * Ensures GeoJSON location data is valid for 2dsphere indexing.
 */
export const createFakeUser = (role: UserRole = "user", overrides?: any) => {
  const password = "password123";
  const name = faker.person.fullName();

  return {
    _id: new mongoose.Types.ObjectId().toString(),
    name: name,
    email: faker.internet.email().toLowerCase(),
    password,
    role: role,
    interests: [
      faker.helpers.arrayElement(["Music", "Tech", "Art", "Parties", "Sports"]),
      faker.helpers.arrayElement(["Networking", "Fashion", "Gaming", "Food"]),
    ],
    image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,

    location: {
      type: "Point",
      // Generating coords around Port Harcourt [7.0, 4.8]
      coordinates: [
        faker.location.longitude({ min: 6.9, max: 7.1 }),
        faker.location.latitude({ min: 4.7, max: 4.9 }),
      ],
      address: faker.location.streetAddress(),
      neighborhood: faker.location.secondaryAddress(),
      city: "Port Harcourt",
    },

    active: true,
    ...overrides,
  };
};

/**
 * Helper for testing signup flow (includes passwordConfirm)
 */
export const createFakeUserForSignup = (
  role: UserRole = "user",
  overrides?: any,
) => {
  const user = createFakeUser(role, overrides);
  return {
    ...user,
    passwordConfirm: user.password,
  };
};
