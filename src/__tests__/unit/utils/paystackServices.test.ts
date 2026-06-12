import { jest } from "@jest/globals";

const mockedAxios = jest.fn();

jest.unstable_mockModule("axios", () => ({
  default: mockedAxios,
}));

describe("PaystackService", () => {
  let PaystackService: typeof import("../../../utils/paystackServices.js").PaystackService;

  beforeAll(async () => {
    ({ PaystackService } = await import("../../../utils/paystackServices.js"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("initializes transactions through Paystack", async () => {
    (mockedAxios as any).mockResolvedValue({
      data: { status: true, data: { id: 1 } },
    });

    const payload = {
      email: "buyer@skaute.test",
      amount: 500000,
      metadata: { eventId: "event-1" },
      callback_url: "https://skaute.test/callback",
    };

    await expect(
      PaystackService.initializeTransaction(payload),
    ).resolves.toEqual({ status: true, data: { id: 1 } });

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: expect.stringContaining("/transaction/initialize"),
        data: payload,
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("verifies transactions by reference", async () => {
    (mockedAxios as any).mockResolvedValue({ data: { status: true } });

    await PaystackService.verifyTransaction("ref-123");

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: expect.stringContaining("/transaction/verify/ref-123"),
      }),
    );
  });

  it("creates subaccounts", async () => {
    (mockedAxios as any).mockResolvedValue({ data: { status: true } });
    const payload = {
      business_name: "Skaute Vendor",
      settlement_bank: "044",
      account_number: "0123456789",
      percentage_charge: 5,
    };

    await PaystackService.createSubaccount(payload);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: expect.stringContaining("/subaccount"),
        data: payload,
      }),
    );
  });

  it("sends refund amount only when provided", async () => {
    (mockedAxios as any).mockResolvedValue({ data: { status: true } });

    await PaystackService.refund("txn-1", 2000);
    await PaystackService.refund("txn-2");

    expect(mockedAxios).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: "POST",
        url: expect.stringContaining("/refund"),
        data: { transaction: "txn-1", amount: 2000 },
      }),
    );
    expect(mockedAxios).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { transaction: "txn-2" },
      }),
    );
  });
});
