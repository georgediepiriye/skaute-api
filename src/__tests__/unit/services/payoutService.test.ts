import { jest } from "@jest/globals";
import httpStatus from "http-status";
import * as payoutService from "../../../controllers/services/payoutService.js";
import { Event } from "../../../models/Event.js";
import { Payout } from "../../../models/Payout.js";
import { Ticket } from "../../../models/Ticket.js";
import AppError from "../../../utils/AppError.js";

describe("Payout Service Unit Tests", () => {
  const findEventSpy = jest.spyOn(Event, "findById");
  const ticketAggregateSpy = jest.spyOn(Ticket, "aggregate");
  const payoutAggregateSpy = jest.spyOn(Payout, "aggregate");
  const payoutCreateSpy = jest.spyOn(Payout, "create");
  const payoutFindSpy = jest.spyOn(Payout, "find");

  const bankDetails = {
    bankName: "Test Bank",
    accountNumber: "0123456789",
    accountName: "Skaute Tester",
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("throws NOT_FOUND when the event does not exist", async () => {
    (findEventSpy as any).mockResolvedValue(null);

    await expect(
      payoutService.createPayoutInstruction(
        "user-1",
        "event-1",
        1000,
        bankDetails,
      ),
    ).rejects.toThrow(
      new AppError(httpStatus.NOT_FOUND, "Target event entity not found."),
    );
  });

  it("throws FORBIDDEN when requester is not the primary organizer", async () => {
    (findEventSpy as any).mockResolvedValue({
      _id: "event-1",
      organizer: { toString: () => "owner-1" },
    } as any);

    await expect(
      payoutService.createPayoutInstruction(
        "intruder-1",
        "event-1",
        1000,
        bankDetails,
      ),
    ).rejects.toThrow(/Only the primary event host/i);
  });

  it("throws BAD_REQUEST for invalid payout amount", async () => {
    (findEventSpy as any).mockResolvedValue({
      _id: "event-1",
      organizer: { toString: () => "owner-1" },
    } as any);

    await expect(
      payoutService.createPayoutInstruction(
        "owner-1",
        "event-1",
        0,
        bankDetails,
      ),
    ).rejects.toThrow(/Invalid payout amount/i);
  });

  it("creates a payout and returns calculated financials", async () => {
    (findEventSpy as any).mockResolvedValue({
      _id: "event-1",
      organizer: { toString: () => "owner-1" },
    } as any);
    (ticketAggregateSpy as any).mockResolvedValue([{ grossRevenue: 10000 }] as any);
    (payoutAggregateSpy as any).mockResolvedValue([{ totalPayouts: 1000 }] as any);
    (payoutCreateSpy as any).mockResolvedValue({ _id: "payout-1" } as any);

    const result = await payoutService.createPayoutInstruction(
      "owner-1",
      "event-1",
      2000,
      bankDetails,
    );

    expect(payoutCreateSpy).toHaveBeenCalledWith({
      organizer: "owner-1",
      event: "event-1",
      amount: 2000,
      bankDetails,
      status: "pending",
    });
    expect(result.payout).toEqual({ _id: "payout-1" });
    expect(result.financials.grossRevenue).toBe(10000);
    expect(result.financials.totalPayouts).toBe(1000);
    expect(result.financials.withdrawableBalance).toBeGreaterThan(0);
  });

  it("rejects payout requests above withdrawable balance", async () => {
    (findEventSpy as any).mockResolvedValue({
      _id: "event-1",
      organizer: { toString: () => "owner-1" },
    } as any);
    (ticketAggregateSpy as any).mockResolvedValue([{ grossRevenue: 1000 }] as any);
    (payoutAggregateSpy as any).mockResolvedValue([{ totalPayouts: 0 }] as any);

    await expect(
      payoutService.createPayoutInstruction(
        "owner-1",
        "event-1",
        5000,
        bankDetails,
      ),
    ).rejects.toThrow(/Insufficient withdrawable balance/i);
  });

  it("fetches organizer payouts with sorting and event population", async () => {
    const populate = (jest.fn() as any).mockResolvedValue([{ _id: "payout-1" }] as any);
    const sort = jest.fn().mockReturnValue({ populate });
    payoutFindSpy.mockReturnValue({ sort } as any);

    const result = await payoutService.getPayoutsByOrganizer("owner-1");

    expect(payoutFindSpy).toHaveBeenCalledWith({ organizer: "owner-1" });
    expect(sort).toHaveBeenCalledWith({ requestedAt: -1, createdAt: -1 });
    expect(populate).toHaveBeenCalledWith("event", "title slug");
    expect(result).toEqual([{ _id: "payout-1" }]);
  });
});
