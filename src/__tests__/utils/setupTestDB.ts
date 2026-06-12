import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

const getSafeLocalTestDatabaseUrl = () => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const devUrl = process.env.DEV_DATABASE_URL;
  if (!devUrl || devUrl.startsWith("mongodb+srv://")) {
    return null;
  }

  try {
    const parsedUrl = new URL(devUrl);
    const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(
      parsedUrl.hostname,
    );

    if (!isLocalHost) {
      return null;
    }

    parsedUrl.pathname = "/skaute-jest-test";
    return parsedUrl.toString();
  } catch {
    return null;
  }
};

const connectTestDatabase = async () => {
  const fallbackUrl = getSafeLocalTestDatabaseUrl();
  if (
    fallbackUrl &&
    (process.env.TEST_DATABASE_URL ||
      process.env.SKIP_MONGO_MEMORY_SERVER === "true")
  ) {
    await mongoose.connect(fallbackUrl);
    return;
  }

  try {
    const fixedPort = process.env.MONGO_MEMORY_FIXED_PORT === "true";
    const instance = {
      ip: "127.0.0.1",
      launchTimeout: 60000,
      ...(fixedPort
        ? { port: Number(process.env.MONGO_MEMORY_PORT || 27018) }
        : {}),
    };

    mongoServer = new MongoMemoryServer({ instance });
    await mongoServer.start(fixedPort);
    await mongoose.connect(mongoServer.getUri());
  } catch (error: any) {
    if (mongoServer) {
      await mongoServer.stop().catch(() => undefined);
      mongoServer = null;
    }

    if (fallbackUrl) {
      process.env.SKIP_MONGO_MEMORY_SERVER = "true";
      console.warn(
        `MongoMemoryServer failed to start (${error?.message}). Falling back to local test database: ${fallbackUrl}`,
      );
      await mongoose.connect(fallbackUrl);
      return;
    }

    throw new Error(
      `MongoMemoryServer failed to start and no safe local TEST_DATABASE_URL was available. Set TEST_DATABASE_URL=mongodb://127.0.0.1:27017/skaute-jest-test. Original error: ${error?.message}`,
    );
  }
};

const setupTestDB = () => {
  jest.setTimeout(30000);

  // 1. Establish connection before all tests in the file
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await connectTestDatabase();
  });

  // 2. Clear data before each individual test
  beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Test database is not connected.");
    }

    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map((collection) => collection.deleteMany({})),
    );
  });

  // 3. Clean up after all tests are done
  afterAll(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Graceful Disconnect
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      await mongoose.disconnect();
    }

    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  });
};

export default setupTestDB;
