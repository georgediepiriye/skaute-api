import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Hotspot from "../../../models/Hotspot.js";
import HotspotContribution from "../../../models/HotspotContribution.js";
import HotspotSuggestion from "../../../models/HotspotSuggestion.js";

jest.unstable_mockModule("../../../socket.js", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
}));

describe("Hotspot Service Unit Tests", () => {
  let hotspotService: typeof import("../../../controllers/services/hotspotService.js");
  const hotspotFindSpy = jest.spyOn(Hotspot, "find");
  const hotspotCountSpy = jest.spyOn(Hotspot, "countDocuments");
  const hotspotFindByIdSpy = jest.spyOn(Hotspot, "findById");
  const hotspotCreateSpy = jest.spyOn(Hotspot, "create");
  const hotspotFindByIdAndUpdateSpy = jest.spyOn(Hotspot, "findByIdAndUpdate");
  const hotspotFindByIdAndDeleteSpy = jest.spyOn(Hotspot, "findByIdAndDelete");
  const contributionFindOneSpy = jest.spyOn(HotspotContribution, "findOne");
  const contributionCreateSpy = jest.spyOn(HotspotContribution, "create");
  const suggestionCreateSpy = jest.spyOn(HotspotSuggestion, "create");

  beforeAll(async () => {
    hotspotService = await import(
      "../../../controllers/services/hotspotService.js"
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds filters, sorting, and pagination for hotspot listing", async () => {
    const queryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: (jest.fn() as any).mockResolvedValue([{ title: "Spot" }] as any),
    };
    hotspotFindSpy.mockReturnValue(queryChain as any);
    (hotspotCountSpy as any).mockResolvedValue(1);

    const result = await hotspotService.getAllHotspots({
      search: "lounge",
      activity: "hasKaraoke",
      neighborhood: "GRA",
      page: "2",
      limit: "5",
      sort: "title,-createdAt",
    });

    expect(hotspotFindSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        $text: { $search: "lounge" },
        "activities.hasKaraoke": true,
        "location.neighborhood": { $regex: "GRA", $options: "i" },
        "location.state": { $regex: "^Rivers", $options: "i" },
        isActive: { $ne: false },
      }),
    );
    expect(queryChain.sort).toHaveBeenCalledWith("title -createdAt");
    expect(queryChain.skip).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      hotspots: [{ title: "Spot" }],
      total: 1,
      page: 2,
      limit: 5,
    });
  });

  it("throws when update target is missing", async () => {
    (hotspotFindByIdAndUpdateSpy as any).mockResolvedValue(null);

    await expect(
      hotspotService.updateHotspot("missing", { title: "Nope" }),
    ).rejects.toThrow("Hotspot not found");
  });

  it("throws when delete target is missing", async () => {
    (hotspotFindByIdAndDeleteSpy as any).mockResolvedValue(null);

    await expect(hotspotService.deleteHotspot("missing")).rejects.toThrow(
      "Hotspot not found",
    );
  });

  it("toggles active state and saves hotspot", async () => {
    const save = (jest.fn() as any).mockResolvedValue(undefined);
    const hotspot = { isActive: true, save };
    (hotspotFindByIdSpy as any).mockResolvedValue(hotspot as any);

    const result = await hotspotService.toggleHotspotActive("hotspot-1", false);

    expect(hotspot.isActive).toBe(false);
    expect(save).toHaveBeenCalled();
    expect(result).toBe(hotspot);
  });

  it("creates a hotspot suggestion and normalizes others to other", async () => {
    (suggestionCreateSpy as any).mockResolvedValue({ _id: "suggestion-1" } as any);

    await hotspotService.createHotspotSuggestion({
      data: {
        title: "Community Spot",
        category: "others",
        location: { neighborhood: "GRA" },
        contact: { instagram: "@spot" },
        suggestedBy: { email: "guest@skaute.test" },
      },
      user: { _id: "user-1" },
    });

    expect(suggestionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Community Spot",
        category: "other",
        location: expect.objectContaining({
          neighborhood: "GRA",
          city: "Port Harcourt",
          state: "Rivers State",
        }),
        suggestedBy: expect.objectContaining({
          email: "guest@skaute.test",
          userId: "user-1",
        }),
        status: "pending",
      }),
    );
  });

  it("creates a contribution and stamps lastContributionAt", async () => {
    const save = (jest.fn() as any).mockResolvedValue(undefined);
    const hotspot = { _id: new mongoose.Types.ObjectId(), save };
    (hotspotFindByIdSpy as any).mockResolvedValue(hotspot as any);
    (contributionFindOneSpy as any).mockResolvedValue(null);
    (contributionCreateSpy as any).mockResolvedValue({ _id: "contribution-1" } as any);

    const result = await hotspotService.createHotspotContribution({
      hotspotId: "hotspot-1",
      user: { _id: "user-1", email: "user@skaute.test", name: "User" },
      ip: "127.0.0.1",
      type: "contact",
      payload: { value: "08030000000" },
    });

    expect(contributionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        hotspot: hotspot._id,
        user: "user-1",
        type: "contact",
        submittedBy: expect.objectContaining({
          email: "user@skaute.test",
          ip: "127.0.0.1",
        }),
      }),
    );
    expect(save).toHaveBeenCalled();
    expect(result).toEqual({ _id: "contribution-1" });
  });

  it("rejects recent duplicate contributions", async () => {
    (hotspotFindByIdSpy as any).mockResolvedValue({ _id: "hotspot-1" } as any);
    (contributionFindOneSpy as any).mockResolvedValue({ _id: "existing" } as any);

    await expect(
      hotspotService.createHotspotContribution({
        hotspotId: "hotspot-1",
        ip: "127.0.0.1",
        type: "photo",
        payload: {},
      }),
    ).rejects.toThrow(/similar update was already submitted/i);
  });

  it("casts a vibe, replaces existing user vote, and recounts weighted vibes", async () => {
    const save = (jest.fn() as any).mockResolvedValue(undefined);
    const markModified = jest.fn();
    const hotspot = {
      category: "lounge",
      vibeCheck: {
        votes: [
          { userId: "user-1", vibe: "DULL", weight: 1 },
          { userId: "user-2", vibe: "LIT", weight: 1 },
        ],
        counts: {},
        currentVibe: "UNKNOWN",
        totalVotes: 0,
      },
      markModified,
      save,
      toObject: jest.fn().mockReturnValue({
        vibeCheck: { currentVibe: "LIT" },
        energyScore: 80,
        vibeScore: 90,
        heatIntensity: 60,
        vibeFreshness: 70,
        computedAuraRadius: 116,
      }),
    };
    (hotspotFindByIdSpy as any).mockResolvedValue(hotspot as any);

    const result = await hotspotService.castVibe(
      "hotspot-1",
      "user-1",
      "LIT",
    );

    expect(hotspot.vibeCheck.votes).toHaveLength(2);
    expect(hotspot.vibeCheck.currentVibe).toBe("LIT");
    expect(hotspot.vibeCheck.totalVotes).toBe(2);
    expect(markModified).toHaveBeenCalledWith("vibeCheck");
    expect(save).toHaveBeenCalled();
    expect(result.energyScore).toBe(80);
  });

  it("throws when casting vibe for missing hotspot", async () => {
    (hotspotFindByIdSpy as any).mockResolvedValue(null);

    await expect(
      hotspotService.castVibe("missing", "user-1", "LIT"),
    ).rejects.toThrow("Hotspot not found");
  });

  it("delegates create hotspot to the model", async () => {
    (hotspotCreateSpy as any).mockResolvedValue({ _id: "hotspot-1" } as any);

    await expect(
      hotspotService.createHotspot({ title: "Spot" }),
    ).resolves.toEqual({ _id: "hotspot-1" });
  });
});
