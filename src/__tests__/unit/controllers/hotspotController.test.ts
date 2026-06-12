import { jest } from "@jest/globals";

const getAllHotspots = jest.fn();
const getHotspotById = jest.fn();
const createHotspot = jest.fn();
const updateHotspot = jest.fn();
const deleteHotspot = jest.fn();
const toggleHotspotActive = jest.fn();
const createHotspotContribution = jest.fn();
const createHotspotSuggestion = jest.fn();
const castVibe = jest.fn();
const cloudinaryConfig = jest.fn();
const uploadStream = jest.fn();

jest.unstable_mockModule("cloudinary", () => ({
  v2: {
    config: cloudinaryConfig,
    uploader: {
      upload_stream: uploadStream,
    },
  },
}));

jest.unstable_mockModule("../../../controllers/services/hotspotService.js", () => ({
  getAllHotspots,
  getHotspotById,
  createHotspot,
  updateHotspot,
  deleteHotspot,
  toggleHotspotActive,
  createHotspotContribution,
  createHotspotSuggestion,
  castVibe,
}));

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
};

const mockUploadResult = (secureUrl = "https://cloudinary.test/hotspot.jpg") => {
  (uploadStream as any).mockImplementation((_options: any, callback: any) => ({
    end: jest.fn(() =>
      callback(null, {
        secure_url: secureUrl,
        public_id: "skaute/hotspots/test",
        resource_type: "image",
        format: "jpg",
        bytes: 1234,
        width: 1200,
        height: 800,
      }),
    ),
  }));
};

describe("Hotspot Controller Unit Tests", () => {
  let hotspotController: typeof import("../../../controllers/hotspotController.js");

  beforeAll(async () => {
    hotspotController = await import("../../../controllers/hotspotController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockUploadResult();
  });

  it("configures Cloudinary on import", () => {
    expect(cloudinaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: expect.any(String),
        api_key: expect.any(String),
        api_secret: expect.any(String),
      }),
    );
  });

  it("lists hotspots with pagination", async () => {
    const res = mockResponse();
    (getAllHotspots as any).mockResolvedValue({
      hotspots: [{ _id: "hotspot-1" }],
      total: 11,
      page: 2,
      limit: 5,
    });

    await hotspotController.getAllHotspots({ query: { page: "2" } } as any, res, jest.fn());

    expect(getAllHotspots).toHaveBeenCalledWith({ page: "2" });
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      results: 1,
      pagination: { total: 11, page: 2, pages: 3 },
      data: { hotspots: [{ _id: "hotspot-1" }] },
    });
  });

  it("returns hotspot details or 404 when missing", async () => {
    const foundRes = mockResponse();
    (getHotspotById as any).mockResolvedValueOnce({ _id: "hotspot-1" });
    await hotspotController.getHotspotDetails(
      { params: { hotspotId: "hotspot-1" } } as any,
      foundRes,
      jest.fn(),
    );
    expect(foundRes.json).toHaveBeenCalledWith({
      status: "success",
      data: { hotspot: { _id: "hotspot-1" } },
    });

    const missingRes = mockResponse();
    (getHotspotById as any).mockResolvedValueOnce(null);
    await hotspotController.getHotspotDetails(
      { params: { hotspotId: "missing" } } as any,
      missingRes,
      jest.fn(),
    );
    expect(missingRes.status).toHaveBeenCalledWith(404);
    expect(missingRes.json).toHaveBeenCalledWith({
      status: "fail",
      message: "Venue not found",
    });
  });

  it("creates hotspots from hotspotData with fallback image and normalized location", async () => {
    const res = mockResponse();
    (createHotspot as any).mockResolvedValue({ _id: "hotspot-1" });

    await hotspotController.createHotspot(
      {
        body: {
          hotspotData: JSON.stringify({
            title: "Wine Lab",
            category: "lounge",
            imageFile: "client-only",
            galleryFiles: ["client-only"],
            location: {
              coordinates: [7.01, 4.81],
              address: "GRA",
              neighborhood: "GRA",
            },
            gallery: ["https://existing.test/1.jpg"],
          }),
        },
        files: {},
      } as any,
      res,
      jest.fn(),
    );

    expect(createHotspot).toHaveBeenCalledWith({
      title: "Wine Lab",
      category: "lounge",
      image: "https://picsum.photos/seed/skaute-hotspot/1200/800",
      gallery: ["https://existing.test/1.jpg"],
      location: {
        type: "Point",
        coordinates: [7.01, 4.81],
        address: "GRA",
        neighborhood: "GRA",
        city: "Port Harcourt",
        state: "Rivers State",
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("uploads cover and gallery images when creating hotspots", async () => {
    const res = mockResponse();
    (createHotspot as any).mockResolvedValue({ _id: "hotspot-1" });

    await hotspotController.createHotspot(
      {
        body: {
          title: "Rooftop",
          location: {
            coordinates: [7.02, 4.82],
            address: "D-Line",
            neighborhood: "D-Line",
            city: "PH",
            state: "Rivers",
          },
        },
        files: {
          image: [{ buffer: Buffer.from("cover") }],
          gallery: [{ buffer: Buffer.from("gallery-a") }, { buffer: Buffer.from("gallery-b") }],
        },
      } as any,
      res,
      jest.fn(),
    );

    expect(uploadStream).toHaveBeenCalledTimes(3);
    expect(createHotspot).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "https://cloudinary.test/hotspot.jpg",
        gallery: [
          "https://cloudinary.test/hotspot.jpg",
          "https://cloudinary.test/hotspot.jpg",
        ],
      }),
    );
  });

  it("updates hotspots with uploaded media and normalized coordinates", async () => {
    const res = mockResponse();
    (updateHotspot as any).mockResolvedValue({ _id: "hotspot-1", title: "Updated" });

    await hotspotController.updateHotspot(
      {
        params: { hotspotId: "hotspot-1" },
        body: {
          hotspotData: JSON.stringify({
            title: "Updated",
            imageFile: "client-only",
            galleryFiles: ["client-only"],
            location: { coordinates: [7.03, 4.83], address: "Woji" },
          }),
        },
        files: {
          image: [{ buffer: Buffer.from("cover") }],
          gallery: [{ buffer: Buffer.from("gallery") }],
        },
      } as any,
      res,
      jest.fn(),
    );

    expect(updateHotspot).toHaveBeenCalledWith("hotspot-1", {
      title: "Updated",
      image: "https://cloudinary.test/hotspot.jpg",
      gallery: ["https://cloudinary.test/hotspot.jpg"],
      location: {
        type: "Point",
        coordinates: [7.03, 4.83],
        address: "Woji",
        city: "Port Harcourt",
        state: "Rivers State",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deletes and toggles hotspots", async () => {
    const deleteRes = mockResponse();
    await hotspotController.deleteHotspot(
      { params: { hotspotId: "hotspot-1" } } as any,
      deleteRes,
      jest.fn(),
    );
    expect(deleteHotspot).toHaveBeenCalledWith("hotspot-1");
    expect(deleteRes.status).toHaveBeenCalledWith(204);
    expect(deleteRes.send).toHaveBeenCalled();

    const toggleRes = mockResponse();
    (toggleHotspotActive as any).mockResolvedValue({ _id: "hotspot-1", isActive: false });
    await hotspotController.toggleHotspotActive(
      { params: { hotspotId: "hotspot-1" }, body: { isActive: false } } as any,
      toggleRes,
      jest.fn(),
    );
    expect(toggleHotspotActive).toHaveBeenCalledWith("hotspot-1", false);
    expect(toggleRes.json).toHaveBeenCalledWith({
      status: "success",
      data: {
        hotspot: { _id: "hotspot-1", isActive: false },
        isActive: false,
      },
    });
  });

  it("creates hotspot contributions and merges public submitter fields into payload", async () => {
    const res = mockResponse();
    (createHotspotContribution as any).mockResolvedValue({
      _id: "contribution-1",
      status: "pending",
    });

    await hotspotController.createHotspotContribution(
      {
        params: { hotspotId: "hotspot-1" },
        user: { _id: "user-1" },
        ip: "127.0.0.1",
        body: {
          type: "contact",
          payload: JSON.stringify({ value: "+2348000000000", note: "Listed outside" }),
          email: "guest@test.com",
          name: "Guest",
        },
      } as any,
      res,
      jest.fn(),
    );

    expect(createHotspotContribution).toHaveBeenCalledWith({
      hotspotId: "hotspot-1",
      user: { _id: "user-1" },
      ip: "127.0.0.1",
      type: "contact",
      payload: {
        value: "+2348000000000",
        note: "Listed outside",
        email: "guest@test.com",
        name: "Guest",
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("uploads contribution photo when an image file is provided", async () => {
    (createHotspotContribution as any).mockResolvedValue({ _id: "contribution-1" });

    await hotspotController.createHotspotContribution(
      {
        params: { hotspotId: "hotspot-1" },
        ip: "127.0.0.1",
        file: { buffer: Buffer.from("photo") },
        body: { type: "photo", payload: { note: "Fresh photo" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );

    expect(createHotspotContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          note: "Fresh photo",
          imageUrl: "https://cloudinary.test/hotspot.jpg",
        }),
      }),
    );
  });

  it("creates public hotspot suggestions with optional uploaded image details", async () => {
    const res = mockResponse();
    const createdAt = new Date("2026-06-12T00:00:00.000Z");
    (createHotspotSuggestion as any).mockResolvedValue({
      _id: "suggestion-1",
      title: "The Wine Lab",
      category: "lounge",
      status: "pending",
      location: { neighborhood: "GRA" },
      contact: { instagram: "@winelab" },
      note: "Rooftop spot",
      image: {
        url: "https://cloudinary.test/hotspot.jpg",
        publicId: "skaute/hotspots/test",
      },
      createdAt,
    });

    await hotspotController.createHotspotSuggestion(
      {
        body: {
          suggestionData: JSON.stringify({ title: "The Wine Lab" }),
        },
        file: { buffer: Buffer.from("suggestion") },
        user: { _id: "user-1" },
      } as any,
      res,
      jest.fn(),
    );

    expect(createHotspotSuggestion).toHaveBeenCalledWith({
      data: {
        suggestionData: JSON.stringify({ title: "The Wine Lab" }),
      },
      image: expect.objectContaining({
        url: "https://cloudinary.test/hotspot.jpg",
        publicId: "skaute/hotspots/test",
        uploadedAt: expect.any(Date),
      }),
      user: { _id: "user-1" },
    });
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Hotspot suggestion submitted for review",
      data: {
        suggestion: {
          id: "suggestion-1",
          title: "The Wine Lab",
          category: "lounge",
          status: "pending",
          location: { neighborhood: "GRA" },
          contact: { instagram: "@winelab" },
          note: "Rooftop spot",
          image: {
            url: "https://cloudinary.test/hotspot.jpg",
            publicId: "skaute/hotspots/test",
          },
          createdAt,
        },
      },
    });
  });

  it("casts a hotspot vibe check", async () => {
    const res = mockResponse();
    (castVibe as any).mockResolvedValue({
      _id: "hotspot-1",
      vibeCheck: { chill: 3 },
      status: "ACTIVE",
    });

    await hotspotController.castHotspotVibeCheck(
      {
        params: { hotspotId: "hotspot-1" },
        user: { _id: "user-1" },
        body: { vibe: "chill" },
      },
      res,
      jest.fn(),
    );

    expect(castVibe).toHaveBeenCalledWith("hotspot-1", "user-1", "chill");
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Vibe recorded successfully",
      data: {
        hotspotId: "hotspot-1",
        vibeCheck: { chill: 3 },
        status: "ACTIVE",
      },
    });
  });
});
