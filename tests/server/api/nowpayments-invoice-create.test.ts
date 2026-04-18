import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  findWallet: vi.fn(),
  insertValues: vi.fn(),
  updateWhere: vi.fn(),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
}));

vi.mock("~~/server/utils/session", () => ({
  requireUserSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("~~/server/utils/nowpayments", () => ({
  createInvoice: mocks.createInvoice,
}));

vi.mock("~~/server/utils/drizzle", () => ({
  useDrizzle: () => ({
    query: {
      wallet: {
        findFirst: mocks.findWallet,
      },
    },
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock("~~/db/schema", () => ({
  wallet: { id: "wallet.id", userId: "wallet.userId" },
  nowPayment: { id: "nowPayment.id" },
}));

import handler from "~~/server/api/nowpayments/invoice/create.post";

describe("NOWPayments invoice create API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findWallet.mockResolvedValue({ id: 21, userId: "user-1", balanceUsd: "0.00" });
    mocks.insertValues.mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 7,
          walletId: 21,
          amountUsd: "10.00",
          status: "pending",
        },
      ]),
    });
    mocks.dbInsert.mockReturnValue({ values: mocks.insertValues });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.dbUpdate.mockReturnValue({ set: vi.fn(() => ({ where: mocks.updateWhere })) });
    mocks.createInvoice.mockResolvedValue({
      id: "np-invoice-1",
      invoice_url: "https://nowpayments.io/invoice/np-invoice-1",
    });
  });

  it("rejects an amount outside fixed packages", async () => {
    const event = {
      __body: { amountUsd: 12 },
      __headers: {},
    };

    await expect(handler(event as any)).rejects.toThrow();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it("creates an invoice when amount is an allowed package", async () => {
    const event = {
      __body: { amountUsd: 15 },
      __headers: {},
    };

    const result = await handler(event as any);

    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        priceAmount: 15,
        orderId: "wallet-topup-7",
      })
    );
    expect(result).toEqual({
      invoiceUrl: "https://nowpayments.io/invoice/np-invoice-1",
      invoiceId: "np-invoice-1",
      paymentId: 7,
    });
  });
});
