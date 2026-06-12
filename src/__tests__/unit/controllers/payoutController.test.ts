import { jest } from "@jest/globals";

const createPayoutInstruction = jest.fn();
const getPayoutsByOrganizer = jest.fn();

jest.unstable_mockModule(
  "../../../controllers/services/payoutService.js",
  () => ({
    createPayoutInstruction,
    getPayoutsByOrganizer,
  }),
);

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("Payout Controller Unit Tests", () => {
  let payoutController: typeof import("../../../controllers/payoutController.js");

  beforeAll(async () => {
    payoutController = await import("../../../controllers/payoutController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects payout requests with missing structural fields", async () => {
    const next = jest.fn();

    await payoutController.requestPayout(
      { user: { id: "user-1" }, body: {} } as any,
      mockResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message:
          "All structural ledger parameters and billing destinations are required.",
      }),
    );
  });

  it("rejects payout amounts below threshold", async () => {
    const next = jest.fn();

    await payoutController.requestPayout(
      {
        user: { id: "user-1" },
        body: {
          eventId: "event-1",
          amount: 50,
          bankDetails: { bankName: "Bank", accountNumber: "1", accountName: "A" },
        },
      } as any,
      mockResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Minimum platform payout threshold configuration is ₦100.",
      }),
    );
  });

  it("rejects incomplete bank details", async () => {
    const next = jest.fn();

    await payoutController.requestPayout(
      {
        user: { id: "user-1" },
        body: {
          eventId: "event-1",
          amount: 500,
          bankDetails: { bankName: "Bank" },
        },
      } as any,
      mockResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Complete destination bank coordinates are required.",
      }),
    );
  });

  it("creates payout request successfully", async () => {
    const res = mockResponse();
    const next = jest.fn();
    (createPayoutInstruction as any).mockResolvedValue({ payout: { _id: "payout-1" } });

    await payoutController.requestPayout(
      {
        user: { id: "user-1" },
        body: {
          eventId: "event-1",
          amount: "5000",
          bankDetails: {
            bankName: "Bank",
            accountNumber: "0123456789",
            accountName: "George",
          },
        },
      } as any,
      res,
      next,
    );

    expect(createPayoutInstruction).toHaveBeenCalledWith(
      "user-1",
      "event-1",
      5000,
      {
        bankName: "Bank",
        accountNumber: "0123456789",
        accountName: "George",
      },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it("requires user context before fetching organizer payouts", async () => {
    const next = jest.fn();

    await payoutController.getOrganizerPayouts({} as any, mockResponse(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Unauthorized operational context.",
      }),
    );
  });

  it("returns organizer payouts", async () => {
    const res = mockResponse();
    (getPayoutsByOrganizer as any).mockResolvedValue([{ _id: "payout-1" }]);

    await payoutController.getOrganizerPayouts(
      { user: { id: "user-1" } } as any,
      res,
      jest.fn(),
    );

    expect(getPayoutsByOrganizer).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { payouts: [{ _id: "payout-1" }] },
    });
  });
});
