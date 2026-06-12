import { jest } from "@jest/globals";

const processBooking = jest.fn();
const verifyAndFulfillOrder = jest.fn();
const getTicketById = jest.fn();
const processTicketCheckIn = jest.fn();
const processTicketRefund = jest.fn();
const processManualCheckIn = jest.fn();
const processResendTicket = jest.fn();
const processTicketTransfer = jest.fn();

jest.unstable_mockModule("../../../controllers/services/ticketService.js", () => ({
  processBooking,
  verifyAndFulfillOrder,
  getTicketById,
  processTicketCheckIn,
  processTicketRefund,
  processManualCheckIn,
  processResendTicket,
  processTicketTransfer,
}));

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("Ticket Controller Unit Tests", () => {
  let ticketController: typeof import("../../../controllers/ticketController.js");

  beforeAll(async () => {
    ticketController = await import("../../../controllers/ticketController.js");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("initializes a booking with optional user context and discount details", async () => {
    const res = mockResponse();
    (processBooking as any).mockResolvedValue({ authorizationUrl: "https://pay.test" });

    await ticketController.initializeBooking(
      {
        user: { id: "user-1" },
        body: {
          eventId: "event-1",
          tierName: "VIP",
          quantity: 2,
          email: "buyer@skaute.test",
          firstName: "Ada",
          lastName: "K",
          discountCode: "EARLY",
          eventTitle: "Friday Night",
        },
      } as any,
      res,
      jest.fn(),
    );

    expect(processBooking).toHaveBeenCalledWith(
      "user-1",
      "buyer@skaute.test",
      "event-1",
      "VIP",
      2,
      { firstName: "Ada", lastName: "K" },
      "EARLY",
      "Friday Night",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { authorizationUrl: "https://pay.test" },
    });
  });

  it("returns fulfilled tickets for successful payment verification", async () => {
    const res = mockResponse();
    (verifyAndFulfillOrder as any).mockResolvedValue({
      status: "success",
      order: { reference: "ref-1" },
      tickets: [{ checkInCode: "SK-1" }],
    });

    await ticketController.verifyTicketPayment(
      { params: { reference: "ref-1" } } as any,
      res,
      jest.fn(),
    );

    expect(verifyAndFulfillOrder).toHaveBeenCalledWith("ref-1");
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Payment confirmed!",
      data: {
        order: { reference: "ref-1" },
        tickets: [{ checkInCode: "SK-1" }],
      },
    });
  });

  it("returns pending state when payment has not completed", async () => {
    const res = mockResponse();
    (verifyAndFulfillOrder as any).mockResolvedValue({
      status: "pending",
      message: "Waiting for Paystack",
    });

    await ticketController.verifyTicketPayment(
      { params: { reference: "ref-2" } } as any,
      res,
      jest.fn(),
    );

    expect(res.json).toHaveBeenCalledWith({
      status: "pending",
      message: "Waiting for Paystack",
    });
  });

  it("blocks ticket details when requester is neither owner nor staff", async () => {
    const next = jest.fn();
    (getTicketById as any).mockResolvedValue({ owner: { toString: () => "owner-1" } });

    await ticketController.getTicketDetails(
      { params: { id: "ticket-1" }, user: { id: "user-2", role: "user" } } as any,
      mockResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You do not have permission to view this ticket",
      }),
    );
  });

  it("allows staff to view ticket details", async () => {
    const res = mockResponse();
    const ticket = { owner: { toString: () => "someone-else" }, checkInCode: "SK-1" };
    (getTicketById as any).mockResolvedValue(ticket);

    await ticketController.getTicketDetails(
      { params: { id: "ticket-1" }, user: { id: "staff-1", role: "admin" } } as any,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "success", data: ticket });
  });

  it("processes check-in using device fingerprint header fallback", async () => {
    const res = mockResponse();
    (processTicketCheckIn as any).mockResolvedValue({ status: "checked_in" });

    await ticketController.validateCheckIn(
      {
        params: { eventId: "event-1" },
        user: { id: "scanner-1" },
        headers: { "x-device-fingerprint": "device-1" },
        body: { checkInCode: "SK-1", offlineTimestamp: 123 },
      } as any,
      res,
      jest.fn(),
    );

    expect(processTicketCheckIn).toHaveBeenCalledWith(
      "SK-1",
      "event-1",
      "scanner-1",
      "device-1",
      123,
    );
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Check-in successful!",
      data: { status: "checked_in" },
    });
  });

  it("requires admin or organizer role to refund tickets", async () => {
    const next = jest.fn();

    await ticketController.refundTicket(
      { params: { ticketCode: "SK-1" }, user: { role: "user" } } as any,
      mockResponse(),
      next,
    );

    expect(processTicketRefund).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: "Unauthorized to issue refunds" }),
    );
  });

  it("manual check-in, resend, and transfer call their services", async () => {
    const manualRes = mockResponse();
    const resendRes = mockResponse();
    const transferRes = mockResponse();
    (processManualCheckIn as any).mockResolvedValue({ checkedIn: true });
    (processResendTicket as any).mockResolvedValue(undefined);
    (processTicketTransfer as any).mockResolvedValue({ buyerInfo: { email: "new@test.com" } });

    await ticketController.manualCheckIn(
      { params: { ticketCode: "SK-1" }, user: { _id: "staff-1" } } as any,
      manualRes,
      jest.fn(),
    );
    await ticketController.resendTicket(
      { params: { ticketCode: "SK-1" } } as any,
      resendRes,
      jest.fn(),
    );
    await ticketController.transferTicket(
      {
        params: { ticketCode: "SK-1" },
        body: { firstName: "New", lastName: "Owner", email: "new@test.com" },
      } as any,
      transferRes,
      jest.fn(),
    );

    expect(processManualCheckIn).toHaveBeenCalledWith("SK-1", "staff-1");
    expect(processResendTicket).toHaveBeenCalledWith("SK-1");
    expect(processTicketTransfer).toHaveBeenCalledWith("SK-1", {
      firstName: "New",
      lastName: "Owner",
      email: "new@test.com",
    });
    expect(manualRes.status).toHaveBeenCalledWith(200);
    expect(resendRes.json).toHaveBeenCalledWith({
      status: "success",
      message: "Ticket re-sent successfully",
    });
    expect(transferRes.json).toHaveBeenCalledWith({
      status: "success",
      message: "Ticket transferred successfully",
      data: { buyerInfo: { email: "new@test.com" } },
    });
  });

  it("rejects ticket transfer without complete buyer details", async () => {
    const next = jest.fn();

    await ticketController.transferTicket(
      { params: { ticketCode: "SK-1" }, body: { firstName: "Only" } } as any,
      mockResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: "New buyer details are required" }),
    );
  });
});
