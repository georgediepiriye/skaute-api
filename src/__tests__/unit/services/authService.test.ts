import { jest } from "@jest/globals";
import * as authService from "../../../controllers/services/authService.js";
import AppError from "../../../utils/AppError.js";
import httpStatus from "http-status";
import { User } from "../../../models/User.js";

// NOTE: We removed jest.mock() because spyOn is more reliable for ESM/Mongoose classes.

describe("Auth Service Unit Tests", () => {
  // 1. Initialize spies at the top level
  const findOneSpy = jest.spyOn(User, "findOne");
  const createSpy = jest.spyOn(User, "create");

  afterEach(() => {
    // 2. Clear spy history between tests
    jest.clearAllMocks();
  });

  afterAll(() => {
    // 3. Restore original methods when done
    jest.restoreAllMocks();
  });

  describe("createUser", () => {
    const mockUserData = {
      email: "test@skaute.app",
      name: "George",
      password: "password123",
    };

    it("should throw an error if email is already in use", async () => {
      // Use mockResolvedValue on the spy
      findOneSpy.mockResolvedValue({ email: "test@skaute.app" } as any);

      await expect(authService.createUser(mockUserData)).rejects.toThrow(
        new AppError(httpStatus.BAD_REQUEST, "Email already in use"),
      );

      expect(findOneSpy).toHaveBeenCalledWith({ email: mockUserData.email });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should create a user successfully if email is unique", async () => {
      findOneSpy.mockResolvedValue(null);
      createSpy.mockResolvedValue({
        ...mockUserData,
        _id: "mock_id_123",
      } as any);

      const result = await authService.createUser(mockUserData);

      expect(result).toHaveProperty("_id", "mock_id_123");
      expect(createSpy).toHaveBeenCalledWith(mockUserData);
    });
  });

  describe("verifyUser", () => {
    const loginCredentials = {
      email: "login@skaute.app",
      password: "password123",
    };

    it("should throw UNAUTHORIZED if user is not found", async () => {
      // Mock the chaining .select() method
      const mockQuery = {
        select: (jest.fn() as any).mockResolvedValue(null),
      };
      findOneSpy.mockReturnValue(mockQuery as any);

      await expect(
        authService.verifyUser(
          loginCredentials.email,
          loginCredentials.password,
        ),
      ).rejects.toThrow(
        new AppError(httpStatus.UNAUTHORIZED, "Incorrect email or password"),
      );
    });

    it("should throw UNAUTHORIZED if password check fails", async () => {
      const mockUser = {
        email: "login@skaute.app",
        password: "hashed_password",
        correctPassword: (jest.fn() as any).mockResolvedValue(false),
      };

      const mockQuery = {
        select: (jest.fn() as any).mockResolvedValue(mockUser),
      };
      findOneSpy.mockReturnValue(mockQuery as any);

      await expect(
        authService.verifyUser(
          loginCredentials.email,
          loginCredentials.password,
        ),
      ).rejects.toThrow(
        new AppError(httpStatus.UNAUTHORIZED, "Incorrect email or password"),
      );
    });

    it("should return the user if email and password are correct", async () => {
      const mockUser = {
        _id: "user_id_999",
        email: "login@skaute.app",
        password: "hashed_password",
        correctPassword: (jest.fn() as any).mockResolvedValue(true),
      };

      const mockQuery = {
        select: (jest.fn() as any).mockResolvedValue(mockUser),
      };
      findOneSpy.mockReturnValue(mockQuery as any);

      const result = await authService.verifyUser(
        loginCredentials.email,
        loginCredentials.password,
      );

      expect(result).toEqual(mockUser);
      expect(mockUser.correctPassword).toHaveBeenCalledWith(
        loginCredentials.password,
        "hashed_password",
      );
    });
  });
});
