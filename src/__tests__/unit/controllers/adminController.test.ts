import { jest } from "@jest/globals";

const getModerationQueue = jest.fn();
const getEventForPreview = jest.fn();
const getHotspotsList = jest.fn();
const getHotspotSuggestions = jest.fn();
const getHotspotSuggestionById = jest.fn();
const updateHotspotSuggestion = jest.fn();
const approveHotspotSuggestion = jest.fn();
const rejectHotspotSuggestion = jest.fn();
const deleteHotspotSuggestion = jest.fn();
const getHotspotContributionQueue = jest.fn();
const approveHotspotContribution = jest.fn();
const rejectHotspotContribution = jest.fn();
const processBulkTicketIssue = jest.fn();
const updateApprovalStatus = jest.fn();
const getUsersList = jest.fn();
const updateUserStatus = jest.fn();
const updateUserVerification = jest.fn();
const getPulseMetrics = jest.fn();
const getEventManagementDetails = jest.fn();
const getPayoutsList = jest.fn();
const processManualPayoutCompletion = jest.fn();
const updateEventPromotionStatus = jest.fn();
const getTelemetryDataset = jest.fn();

jest.unstable_mockModule("../../../controllers/services/adminService.js", () => ({
  getModerationQueue,
  getEventForPreview,
  getHotspotsList,
  getHotspotSuggestions,
  getHotspotSuggestionById,
  updateHotspotSuggestion,
  approveHotspotSuggestion,
  rejectHotspotSuggestion,
  deleteHotspotSuggestion,
  getHotspotContributionQueue,
  approveHotspotContribution,
  rejectHotspotContribution,
  processBulkTicketIssue,
  updateApprovalStatus,
  getUsersList,
  updateUserStatus,
  updateUserVerification,
  getPulseMetrics,
  getEventManagementDetails,
  getPayoutsList,
  processManualPayoutCompletion,
  updateEventPromotionStatus,
  getTelemetryDataset,
}));

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("Admin Controller Unit Tests", () => {
  let adminController: typeof import("../../../controllers/adminController.js");

  beforeAll(async () => {
    adminController = await import("../../../controllers/adminController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns moderation queue with pagination counts", async () => {
    const res = mockResponse();
    (getModerationQueue as any).mockResolvedValue({
      events: [{ _id: "event-1" }],
      pagination: {
        totalEvents: 5,
        totalPages: 2,
        page: 1,
        limit: 3,
        counts: { pending: 4 },
      },
    });

    await adminController.getModerationQueue({ query: { status: "pending" } } as any, res, jest.fn());

    expect(getModerationQueue).toHaveBeenCalledWith({ status: "pending" });
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      results: 1,
      pagination: {
        totalEvents: 5,
        totalPages: 2,
        page: 1,
        limit: 3,
        counts: { pending: 4 },
      },
      data: { events: [{ _id: "event-1" }] },
    });
  });

  it("returns event preview or 404 when unavailable", async () => {
    const foundRes = mockResponse();
    (getEventForPreview as any).mockResolvedValueOnce({ _id: "event-1" });
    await adminController.getEventPreview(
      { params: { id: "event-1" } } as any,
      foundRes,
      jest.fn(),
    );
    expect(foundRes.json).toHaveBeenCalledWith({
      status: "success",
      data: { event: { _id: "event-1" } },
    });

    const missingRes = mockResponse();
    (getEventForPreview as any).mockResolvedValueOnce(null);
    await adminController.getEventPreview(
      { params: { id: "missing" } } as any,
      missingRes,
      jest.fn(),
    );
    expect(missingRes.status).toHaveBeenCalledWith(404);
  });

  it("lists admin hotspots and suggestions", async () => {
    (getHotspotsList as any).mockResolvedValue({
      hotspots: [{ _id: "hotspot-1" }],
      pagination: { page: 1, pages: 1, total: 1 },
    });
    const hotspotsRes = mockResponse();
    await adminController.getAllHotspots({ query: { search: "bar" } } as any, hotspotsRes, jest.fn());
    expect(hotspotsRes.json).toHaveBeenCalledWith({
      status: "success",
      results: 1,
      pagination: { page: 1, pages: 1, total: 1 },
      data: { hotspots: [{ _id: "hotspot-1" }] },
    });

    (getHotspotSuggestions as any).mockResolvedValue({
      suggestions: [{ _id: "suggestion-1" }],
      pagination: { page: 1 },
    });
    const suggestionsRes = mockResponse();
    await adminController.getHotspotSuggestions(
      { query: { status: "pending" } } as any,
      suggestionsRes,
      jest.fn(),
    );
    expect(suggestionsRes.json).toHaveBeenCalledWith({
      status: "success",
      data: { suggestions: [{ _id: "suggestion-1" }], pagination: { page: 1 } },
    });
  });

  it("handles hotspot suggestion review workflow", async () => {
    (getHotspotSuggestionById as any).mockResolvedValue({ _id: "suggestion-1" });
    const getRes = mockResponse();
    await adminController.getHotspotSuggestion(
      { params: { id: "suggestion-1" } } as any,
      getRes,
      jest.fn(),
    );
    expect(getRes.json).toHaveBeenCalledWith({
      status: "success",
      data: { suggestion: { _id: "suggestion-1" } },
    });

    (updateHotspotSuggestion as any).mockResolvedValue({ _id: "suggestion-1", title: "New" });
    await adminController.updateHotspotSuggestion(
      { params: { id: "suggestion-1" }, body: { title: "New" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(updateHotspotSuggestion).toHaveBeenCalledWith("suggestion-1", { title: "New" });

    (approveHotspotSuggestion as any).mockResolvedValue({
      suggestion: { _id: "suggestion-1", status: "approved" },
      hotspot: { _id: "hotspot-1" },
    });
    const approveRes = mockResponse();
    await adminController.approveHotspotSuggestion(
      { params: { id: "suggestion-1" }, user: { _id: { toString: () => "admin-1" } } } as any,
      approveRes,
      jest.fn(),
    );
    expect(approveHotspotSuggestion).toHaveBeenCalledWith("suggestion-1", "admin-1");
    expect(approveRes.status).toHaveBeenCalledWith(201);

    (rejectHotspotSuggestion as any).mockResolvedValue({
      _id: "suggestion-1",
      status: "rejected",
    });
    await adminController.rejectHotspotSuggestion(
      {
        params: { id: "suggestion-1" },
        user: { id: { toString: () => "admin-2" } },
        body: { adminNotes: "Could not verify" },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(rejectHotspotSuggestion).toHaveBeenCalledWith(
      "suggestion-1",
      "admin-2",
      "Could not verify",
    );

    await adminController.deleteHotspotSuggestion(
      { params: { id: "suggestion-1" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(deleteHotspotSuggestion).toHaveBeenCalledWith("suggestion-1");
  });

  it("handles contribution review and bulk ticket issue", async () => {
    (getHotspotContributionQueue as any).mockResolvedValue({
      contributions: [{ _id: "contribution-1" }],
      pagination: { total: 1 },
    });
    const queueRes = mockResponse();
    await adminController.getHotspotContributionQueue({ query: {} } as any, queueRes, jest.fn());
    expect(queueRes.json).toHaveBeenCalledWith({
      status: "success",
      data: { contributions: [{ _id: "contribution-1" }] },
      pagination: { total: 1 },
    });

    (approveHotspotContribution as any).mockResolvedValue({
      contribution: { _id: "contribution-1", status: "approved" },
      hotspot: { _id: "hotspot-1" },
    });
    await adminController.approveHotspotContribution(
      {
        params: { id: "contribution-1" },
        user: { _id: { toString: () => "admin-1" } },
        body: { adminNote: "ok", applyMode: "auto" },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(approveHotspotContribution).toHaveBeenCalledWith(
      "contribution-1",
      "admin-1",
      "ok",
      "auto",
    );

    (rejectHotspotContribution as any).mockResolvedValue({
      _id: "contribution-1",
      status: "rejected",
    });
    await adminController.rejectHotspotContribution(
      {
        params: { id: "contribution-1" },
        user: { id: { toString: () => "admin-2" } },
        body: { adminNote: "no" },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(rejectHotspotContribution).toHaveBeenCalledWith("contribution-1", "admin-2", "no");

    (processBulkTicketIssue as any).mockResolvedValue([{ _id: "ticket-1" }, { _id: "ticket-2" }]);
    const bulkRes = mockResponse();
    await adminController.issueBulkTickets(
      {
        params: { id: "event-1" },
        user: { _id: { toString: () => "admin-1" } },
        body: { guests: [{ email: "guest@test.com" }] },
      } as any,
      bulkRes,
      jest.fn(),
    );
    expect(bulkRes.json).toHaveBeenCalledWith({
      status: "success",
      message: "2 ticket(s) issued successfully.",
      results: 2,
      data: { tickets: [{ _id: "ticket-1" }, { _id: "ticket-2" }] },
    });
  });

  it("covers admin user, analytics, payout, and telemetry endpoints", async () => {
    (updateApprovalStatus as any).mockResolvedValue({ _id: "event-1", status: "approved" });
    await adminController.processApproval(
      {
        params: { id: "event-1" },
        user: { id: { toString: () => "admin-1" } },
        body: { status: "approved", reason: "good" },
      } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(updateApprovalStatus).toHaveBeenCalledWith("event-1", "approved", "admin-1", "good");

    (getUsersList as any).mockResolvedValue({
      users: [{ _id: "user-1" }],
      pagination: { total: 1 },
    });
    await adminController.getAllUsers({ query: {} } as any, mockResponse(), jest.fn());
    expect(getUsersList).toHaveBeenCalledWith({});

    (updateUserStatus as any).mockResolvedValue({ _id: "user-1", status: "suspended" });
    await adminController.toggleUserStatus(
      { params: { id: "user-1" }, body: { status: "suspended" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(updateUserStatus).toHaveBeenCalledWith("user-1", "suspended");

    (updateUserVerification as any).mockResolvedValue({ _id: "user-1", isVerified: true });
    await adminController.toggleUserVerification(
      { params: { id: "user-1" }, body: { isVerified: true } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(updateUserVerification).toHaveBeenCalledWith("user-1", true);

    (getPulseMetrics as any).mockResolvedValue({ activeEvents: 3 });
    await adminController.getPulseAnalytics({} as any, mockResponse(), jest.fn());
    expect(getPulseMetrics).toHaveBeenCalled();

    (getEventManagementDetails as any).mockResolvedValue({ revenue: 500 });
    await adminController.getEventManagementData(
      { params: { id: "event-1" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(getEventManagementDetails).toHaveBeenCalledWith("event-1");

    (getPayoutsList as any).mockResolvedValue({ payouts: [{ _id: "payout-1" }], pagination: {} });
    await adminController.getPayoutQueue({ query: {} } as any, mockResponse(), jest.fn());
    expect(getPayoutsList).toHaveBeenCalledWith({});

    (processManualPayoutCompletion as any).mockResolvedValue({ _id: "payout-1" });
    await adminController.completeManualPayout(
      { params: { id: "payout-1" }, body: { reference: "bank-ref" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(processManualPayoutCompletion).toHaveBeenCalledWith("payout-1", "bank-ref");

    (updateEventPromotionStatus as any).mockResolvedValue({
      _id: "event-1",
      title: "Move",
      status: "approved",
      isSkauteHosted: true,
      isBoosted: false,
      boostTier: null,
      boostExpiry: null,
      priorityLevel: 1,
    });
    const promoRes = mockResponse();
    await adminController.updateEventPromotion(
      { params: { id: "event-1" }, user: { id: { toString: () => "admin-1" } }, body: {} } as any,
      promoRes,
    );
    expect(promoRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Event discoverability settings updated successfully.",
      data: {
        id: "event-1",
        title: "Move",
        status: "approved",
        isSkauteHosted: true,
        isBoosted: false,
        boostTier: null,
        boostExpiry: null,
        priorityLevel: 1,
      },
    });

    (getTelemetryDataset as any).mockResolvedValue({ totals: {} });
    await adminController.getGlobalTelemetry({} as any, mockResponse(), jest.fn());
    await adminController.getEventTelemetry(
      { params: { eventId: "event-1" } } as any,
      mockResponse(),
      jest.fn(),
    );
    expect(getTelemetryDataset).toHaveBeenCalledWith();
    expect(getTelemetryDataset).toHaveBeenCalledWith("event-1");
  });

  it("returns 404 for missing mutable admin records", async () => {
    (updateApprovalStatus as any).mockResolvedValueOnce(null);
    const approvalRes = mockResponse();
    await adminController.processApproval(
      { params: { id: "missing" }, user: { id: "admin-1" }, body: { status: "approved" } } as any,
      approvalRes,
      jest.fn(),
    );
    expect(approvalRes.status).toHaveBeenCalledWith(404);

    (updateUserStatus as any).mockResolvedValueOnce(null);
    const userStatusRes = mockResponse();
    await adminController.toggleUserStatus(
      { params: { id: "missing" }, body: { status: "suspended" } } as any,
      userStatusRes,
      jest.fn(),
    );
    expect(userStatusRes.status).toHaveBeenCalledWith(404);

    (updateUserVerification as any).mockResolvedValueOnce(null);
    const verificationRes = mockResponse();
    await adminController.toggleUserVerification(
      { params: { id: "missing" }, body: { isVerified: false } } as any,
      verificationRes,
      jest.fn(),
    );
    expect(verificationRes.status).toHaveBeenCalledWith(404);

    (getEventManagementDetails as any).mockResolvedValueOnce(null);
    const managementRes = mockResponse();
    await adminController.getEventManagementData(
      { params: { id: "missing" } } as any,
      managementRes,
      jest.fn(),
    );
    expect(managementRes.status).toHaveBeenCalledWith(404);

    (processManualPayoutCompletion as any).mockResolvedValueOnce(null);
    const payoutRes = mockResponse();
    await adminController.completeManualPayout(
      { params: { id: "missing" }, body: { reference: "ref" } } as any,
      payoutRes,
      jest.fn(),
    );
    expect(payoutRes.status).toHaveBeenCalledWith(404);
  });
});
