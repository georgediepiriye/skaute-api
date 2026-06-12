import { jest } from "@jest/globals";
import * as userService from "../../../controllers/services/userService.js";
import { Event } from "../../../models/Event.js";
import { Ticket } from "../../../models/Ticket.js";
import { User } from "../../../models/User.js";

describe("User Service Unit Tests", () => {
  const findByIdSpy = jest.spyOn(User, "findById");
  const findByIdAndUpdateSpy = jest.spyOn(User, "findByIdAndUpdate");
  const eventFindSpy = jest.spyOn(Event, "find");
  const ticketFindSpy = jest.spyOn(Ticket, "find");

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a composed profile without password", async () => {
    const user = { _id: "user-1", name: "George" };
    findByIdSpy.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: (jest.fn() as any).mockResolvedValue(user),
      }),
    } as any);
    eventFindSpy.mockReturnValue({
      sort: (jest.fn() as any).mockResolvedValue([{ title: "Hosted Move" }]),
    } as any);
    ticketFindSpy.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: (jest.fn() as any).mockResolvedValue([{ checkInCode: "SK-1" }]),
        }),
      }),
    } as any);

    const profile = await userService.getUserProfile("user-1");

    expect(profile).toMatchObject({
      _id: "user-1",
      name: "George",
      organizedEvents: [{ title: "Hosted Move" }],
      tickets: [{ checkInCode: "SK-1" }],
    });
    expect(Event.find).toHaveBeenCalledWith({
      $or: [{ organizer: "user-1" }, { "coOrganizers.user": "user-1" }],
    });
  });

  it("throws when profile user is missing", async () => {
    findByIdSpy.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: (jest.fn() as any).mockResolvedValue(null),
      }),
    } as any);
    eventFindSpy.mockReturnValue({
      sort: (jest.fn() as any).mockResolvedValue([]),
    } as any);
    ticketFindSpy.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: (jest.fn() as any).mockResolvedValue([]),
        }),
      }),
    } as any);

    await expect(userService.getUserProfile("missing")).rejects.toThrow(
      "User profile not found",
    );
  });

  it("updates profile fields and strips undefined values", async () => {
    const select = (jest.fn() as any).mockResolvedValue({ _id: "user-1", name: "New" });
    findByIdAndUpdateSpy.mockReturnValue({ select } as any);

    const result = await userService.updateUserProfile("user-1", {
      name: "New",
      image: undefined,
    } as any);

    expect(findByIdAndUpdateSpy).toHaveBeenCalledWith(
      "user-1",
      { $set: { name: "New" } },
      { new: true, runValidators: true },
    );
    expect(select).toHaveBeenCalledWith("-password");
    expect(result).toEqual({ _id: "user-1", name: "New" });
  });

  it("throws when update target is missing", async () => {
    findByIdAndUpdateSpy.mockReturnValue({
      select: (jest.fn() as any).mockResolvedValue(null),
    } as any);

    await expect(
      userService.updateUserProfile("missing", { name: "Nobody" } as any),
    ).rejects.toThrow("User not found");
  });
});
