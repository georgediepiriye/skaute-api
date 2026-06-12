import { jest } from "@jest/globals";

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("Auth Controller Unit Tests", () => {
  let authController: typeof import("../../../controllers/authController.js");

  beforeAll(async () => {
    authController = await import("../../../controllers/authController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("returns 401 from getMe when user context is missing", async () => {
    const res = mockResponse();

    await authController.getMe({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      message: "User context missing. Please log in again.",
    });
  });

  it("returns the current user and disables caching", async () => {
    const res = mockResponse();
    const user = {
      _id: "user-1",
      name: "George",
      email: "george@skaute.test",
      role: "user",
      image: "https://image.test/me.jpg",
      interests: ["music"],
      location: { city: "Port Harcourt" },
    };

    await authController.getMe({ user } as any, res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(res.setHeader).toHaveBeenCalledWith("Expires", "0");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: {
        user: {
          id: "user-1",
          name: "George",
          email: "george@skaute.test",
          role: "user",
          image: "https://image.test/me.jpg",
          interests: ["music"],
          location: { city: "Port Harcourt" },
        },
      },
    });
  });

  it("passes getMe errors to next", async () => {
    const res = mockResponse();
    const next = jest.fn();
    res.setHeader.mockImplementationOnce(() => {
      throw new Error("header failed");
    });

    await authController.getMe({ user: { _id: "user-1" } } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "header failed" }));
  });

  it("clears auth cookies on logout", async () => {
    const res = mockResponse();
    process.env.NODE_ENV = "production";

    await authController.logout({} as any, res);

    expect(res.clearCookie).toHaveBeenCalledWith("skaute_token", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    expect(res.clearCookie).toHaveBeenCalledWith("user_role", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
