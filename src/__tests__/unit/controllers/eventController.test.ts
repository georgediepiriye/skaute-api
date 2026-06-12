import { jest } from "@jest/globals";

const createNewEvent = jest.fn();
const updateEvent = jest.fn();
const getAllEvents = jest.fn();
const findNearbyEvents = jest.fn();
const getEventById = jest.fn();
const recordEventView = jest.fn();
const getManagementDashboardData = jest.fn();
const issueManualComplimentaryTicket = jest.fn();
const addPartnerToEvent = jest.fn();
const removePartnerFromEvent = jest.fn();
const getEventBySlug = jest.fn();
const getActiveEventsCount = jest.fn();
const addDiscountToEvent = jest.fn();
const removeDiscountCode = jest.fn();
const verifyDiscountCode = jest.fn();
const toggleEventSoldOut = jest.fn();
const updateCoOrganizerPermissions = jest.fn();
const getGateControlTelemetryData = jest.fn();
const cancelEvent = jest.fn();
const deleteEvent = jest.fn();

jest.unstable_mockModule("../../../controllers/services/eventService.js", () => ({
  createNewEvent,
  updateEvent,
  getAllEvents,
  findNearbyEvents,
  getEventById,
  recordEventView,
  getManagementDashboardData,
  issueManualComplimentaryTicket,
  addPartnerToEvent,
  removePartnerFromEvent,
  getEventBySlug,
  getActiveEventsCount,
  addDiscountToEvent,
  removeDiscountCode,
  verifyDiscountCode,
  toggleEventSoldOut,
  updateCoOrganizerPermissions,
  getGateControlTelemetryData,
  cancelEvent,
  deleteEvent,
}));

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("Event Controller Unit Tests", () => {
  let eventController: typeof import("../../../controllers/eventController.js");

  beforeAll(async () => {
    eventController = await import("../../../controllers/eventController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates online events with fallback image and strips physical location", async () => {
    const res = mockResponse();
    (createNewEvent as any).mockResolvedValue({ _id: "event-1", title: "Stream" });

    await eventController.createEvent(
      {
        body: {
          eventData: JSON.stringify({
            title: "Stream",
            eventFormat: "online",
            location: { address: "Old address" },
            imageFile: "client-helper",
            locationCoords: [7, 4],
          }),
        },
        user: { _id: { toString: () => "organizer-1" } },
      } as any,
      res,
      jest.fn(),
    );

    expect(createNewEvent).toHaveBeenCalledWith(
      {
        title: "Stream",
        eventFormat: "online",
        image: "https://picsum.photos/seed/skaute/1200/800",
        isOnline: true,
      },
      "organizer-1",
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates events and normalizes online format", async () => {
    const res = mockResponse();
    (updateEvent as any).mockResolvedValue({ _id: "event-1", isOnline: true });

    await eventController.updateEvent(
      {
        params: { id: "event-1" },
        body: { eventFormat: "online", location: { address: "Somewhere" } },
        user: { _id: { toString: () => "organizer-1" } },
      } as any,
      res,
      jest.fn(),
    );

    expect(updateEvent).toHaveBeenCalledWith(
      "event-1",
      { eventFormat: "online", location: null, isOnline: true },
      "organizer-1",
    );
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { event: { _id: "event-1", isOnline: true } },
    });
  });

  it("lists events with pagination metadata", async () => {
    const res = mockResponse();
    (getAllEvents as any).mockResolvedValue({
      events: [{ _id: "event-1" }],
      total: 21,
      page: 2,
      limit: 10,
    });

    await eventController.getAllEvents({ query: { page: "2" } } as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      results: 1,
      pagination: { total: 21, page: 2, pages: 3 },
      data: { events: [{ _id: "event-1" }] },
    });
  });

  it("fetches nearby events using numeric query values", async () => {
    const res = mockResponse();
    (findNearbyEvents as any).mockResolvedValue([{ _id: "near-1" }]);

    await eventController.getNearbyEvents(
      { query: { lng: "7.01", lat: "4.82", distance: "5" } } as any,
      res,
      jest.fn(),
    );

    expect(findNearbyEvents).toHaveBeenCalledWith(7.01, 4.82, 5);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      results: 1,
      data: { events: [{ _id: "near-1" }] },
    });
  });

  it("returns 404 when event is not found", async () => {
    const res = mockResponse();
    (getEventById as any).mockResolvedValue(null);

    await eventController.getEvent({ params: { id: "missing" } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      message: "No event found with that ID",
    });
  });

  it("records event views with user, IP, device, and user-agent context", async () => {
    const res = mockResponse();
    (recordEventView as any).mockResolvedValue({
      event: { _id: "event-1", views: 7 },
      counted: true,
    });

    await eventController.recordEventView(
      {
        params: { id: "event-1" },
        user: { _id: { toString: () => "user-1" } },
        ip: "127.0.0.1",
        headers: { "x-device-fingerprint": "device-1", "user-agent": "jest" },
        body: {},
      } as any,
      res,
      jest.fn(),
    );

    expect(recordEventView).toHaveBeenCalledWith("event-1", {
      userId: "user-1",
      ip: "127.0.0.1",
      deviceFingerprint: "device-1",
      userAgent: "jest",
    });
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { eventId: "event-1", views: 7, counted: true },
    });
  });

  it("issues manual tickets with normalized email and dynamic message", async () => {
    const res = mockResponse();
    (issueManualComplimentaryTicket as any).mockResolvedValue({ ticket: { _id: "ticket-1" } });

    await eventController.issueManualTicket(
      {
        params: { id: "event-1" },
        user: { _id: { toString: () => "operator-1" } },
        body: {
          firstName: "Ada",
          lastName: "King",
          email: " ADA@SKAUTE.TEST ",
          tierId: "tier-1",
          paymentMethod: "cash",
        },
      } as any,
      res,
      jest.fn(),
    );

    expect(issueManualComplimentaryTicket).toHaveBeenCalledWith({
      eventId: "event-1",
      operatorId: "operator-1",
      firstName: "Ada",
      lastName: "King",
      email: "ada@skaute.test",
      tierId: "tier-1",
      paymentMethod: "cash",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Gate ticket registered successfully via CASH.",
      data: { ticket: { _id: "ticket-1" } },
    });
  });

  it("handles partner, discount, sold-out, telemetry, cancel, and delete flows", async () => {
    const res = mockResponse();
    (addPartnerToEvent as any).mockResolvedValue({ _id: "event-1", partners: ["p1"] });
    await eventController.addCoOrganizer(
      {
        params: { eventId: "event-1" },
        body: { email: "partner@test.com", permissions: ["scan"] },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      res,
      jest.fn(),
    );
    expect(addPartnerToEvent).toHaveBeenCalledWith(
      "event-1",
      "partner@test.com",
      ["scan"],
      "owner-1",
    );

    (removePartnerFromEvent as any).mockResolvedValue({ _id: "event-1" });
    await eventController.removeCoOrganizer(
      {
        params: { eventId: "event-1", partnerId: "partner-1" },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(removePartnerFromEvent).toHaveBeenCalledWith("event-1", "partner-1", "owner-1");

    (addDiscountToEvent as any).mockResolvedValue({ _id: "event-1" });
    await eventController.createDiscountCode(
      {
        params: { id: "event-1" },
        body: { code: "SAVE" },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(addDiscountToEvent).toHaveBeenCalledWith("event-1", { code: "SAVE" }, "owner-1");

    (removeDiscountCode as any).mockResolvedValue({ _id: "event-1" });
    await eventController.deleteDiscountCode(
      {
        params: { id: "event-1", discountId: "discount-1" },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(removeDiscountCode).toHaveBeenCalledWith("event-1", "discount-1", "owner-1");

    (verifyDiscountCode as any).mockResolvedValue({
      code: "SAVE",
      discountPercentage: 15,
    });
    const discountRes = mockResponse();
    await eventController.validateDiscountCode(
      { params: { id: "event-1" }, body: { code: "SAVE", tierName: "VIP" } } as any,
      discountRes,
      jest.fn(),
    );
    expect(discountRes.json).toHaveBeenCalledWith({
      status: "success",
      message: "Discount applied successfully",
      discount: { code: "SAVE", discountPercentage: 15 },
    });

    (toggleEventSoldOut as any).mockResolvedValue({
      ticketTiers: { id: () => ({ isSoldOut: true }) },
    });
    const soldOutRes = mockResponse();
    await eventController.toggleSoldOutStatus(
      {
        params: { id: "event-1" },
        body: { tierId: "tier-1" },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      soldOutRes,
      jest.fn(),
    );
    expect(soldOutRes.json).toHaveBeenCalledWith({
      status: "success",
      message: "Marked as Sold Out",
      data: { ticketTiers: expect.any(Object) },
    });

    (getGateControlTelemetryData as any).mockResolvedValue({ scanned: 4 });
    await eventController.getGateControlTelemetry(
      {
        params: { eventId: "event-1" },
        user: { email: "owner@test.com", _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(getGateControlTelemetryData).toHaveBeenCalledWith("event-1", "owner-1");

    (cancelEvent as any).mockResolvedValue({ _id: "event-1", status: "cancelled" });
    await eventController.cancelEvent(
      { params: { id: "event-1" }, user: { _id: { toString: () => "owner-1" } } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(cancelEvent).toHaveBeenCalledWith("event-1", "owner-1");

    await eventController.deleteEvent(
      { params: { id: "event-1" }, user: { _id: { toString: () => "owner-1" } } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(deleteEvent).toHaveBeenCalledWith("event-1", "owner-1");
  });

  it("covers slug, active count, permissions, and management data endpoints", async () => {
    (getEventBySlug as any).mockResolvedValue({ _id: "event-1", slug: "friday" });
    const slugRes = mockResponse();
    await eventController.getEventBySlug(
      { params: { slug: "friday" } } as any,
      slugRes,
      jest.fn(),
    );
    expect(slugRes.status).toHaveBeenCalledWith(200);

    (getActiveEventsCount as any).mockResolvedValue(9);
    const countRes = mockResponse();
    await eventController.getActiveMovesCount({} as any, countRes, jest.fn());
    expect(countRes.json).toHaveBeenCalledWith({ status: "success", data: { count: 9 } });

    (updateCoOrganizerPermissions as any).mockResolvedValue({ _id: "event-1" });
    await eventController.updateCoOrganizerPermissions(
      {
        params: { id: "event-1" },
        body: { coOrganizerId: "co-1", permissions: ["scan"] },
        user: { _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(updateCoOrganizerPermissions).toHaveBeenCalledWith(
      "event-1",
      "co-1",
      ["scan"],
      "owner-1",
    );

    (getManagementDashboardData as any).mockResolvedValue({ revenue: 1000 });
    await eventController.getManagementDashboardData(
      {
        params: { id: "event-1" },
        user: { email: "owner@test.com", _id: { toString: () => "owner-1" } },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(getManagementDashboardData).toHaveBeenCalledWith("event-1", "owner-1");
  });
});
