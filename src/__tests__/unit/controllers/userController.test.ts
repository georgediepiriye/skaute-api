import { jest } from "@jest/globals";

const getUserProfile = jest.fn();
const updateUserProfile = jest.fn();

jest.unstable_mockModule("../../../controllers/services/userService.js", () => ({
  getUserProfile,
  updateUserProfile,
}));

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("User Controller Unit Tests", () => {
  let userController: typeof import("../../../controllers/userController.js");

  beforeAll(async () => {
    userController = await import("../../../controllers/userController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when profile request has no user context", async () => {
    const res = mockResponse();

    await userController.getProfile({} as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized access" });
  });

  it("returns user profile on success", async () => {
    const res = mockResponse();
    (getUserProfile as any).mockResolvedValue({ id: "user-1", name: "George" });

    await userController.getProfile({ user: { id: "user-1" } } as any, res);

    expect(getUserProfile).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { id: "user-1", name: "George" },
    });
  });

  it("returns 500 when profile service throws", async () => {
    const res = mockResponse();
    (getUserProfile as any).mockRejectedValue(new Error("Profile failed"));

    await userController.getProfile({ user: { id: "user-1" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Profile failed",
    });
  });

  it("updates allowed profile fields", async () => {
    const res = mockResponse();
    (updateUserProfile as any).mockResolvedValue({ id: "user-1", name: "New" });

    await userController.updateProfile(
      {
        user: { id: "user-1" },
        body: {
          name: "New",
          email: "new@skaute.test",
          active: false,
          ignored: "field",
        },
      } as any,
      res,
    );

    expect(updateUserProfile).toHaveBeenCalledWith("user-1", {
      name: "New",
      email: "new@skaute.test",
      image: undefined,
      interests: undefined,
      location: undefined,
      active: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 400 for unique update errors", async () => {
    const res = mockResponse();
    (updateUserProfile as any).mockRejectedValue(new Error("email unique conflict"));

    await userController.updateProfile(
      { user: { id: "user-1" }, body: { email: "taken@skaute.test" } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
