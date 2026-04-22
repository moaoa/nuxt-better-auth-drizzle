import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  findWallet: vi.fn(),
  walletInsertValues: vi.fn(),
  nowPaymentInsertValues: vi.fn(),
  walletInsertReturning: vi.fn(),
  nowPaymentInsertReturning: vi.fn(),
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
    mocks.walletInsertReturning.mockResolvedValue([]);
    mocks.nowPaymentInsertReturning.mockResolvedValue([
      {
        id: 7,
        walletId: 21,
        amountUsd: "10.00",
        status: "pending",
      },
    ]);
    mocks.walletInsertValues.mockReturnValue({
      onConflictDoNothing: vi.fn(() => ({
        returning: mocks.walletInsertReturning,
      })),
    });
    mocks.nowPaymentInsertValues.mockReturnValue({
      returning: mocks.nowPaymentInsertReturning,
    });
    mocks.dbInsert.mockImplementation((table: any) => {
      if (table?.id === "wallet.id") {
        return { values: mocks.walletInsertValues };
      }
      if (table?.id === "nowPayment.id") {
        return { values: mocks.nowPaymentInsertValues };
      }
      throw new Error("Unexpected table in db.insert");
    });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.dbUpdate.mockReturnValue({ set: vi.fn(() => ({ where: mocks.updateWhere })) });
    mocks.createInvoice.mockResolvedValue({
      id: "np-invoice-1",
      invoice_url: "https://nowpayments.io/invoice/np-invoice-1",
    });
  });

  it("rejects an amount below minimum", async () => {
    const event = {
      __body: { amountUsd: 0.99 },
      __headers: {},
    };

    await expect(handler(event as any)).rejects.toThrow();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it("rejects an amount above maximum", async () => {
    const event = {
      __body: { amountUsd: 50.01 },
      __headers: {},
    };

    await expect(handler(event as any)).rejects.toThrow();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it("rejects an amount with more than two decimals", async () => {
    const event = {
      __body: { amountUsd: 12.345 },
      __headers: {},
    };

    await expect(handler(event as any)).rejects.toThrow();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it("creates an invoice for a valid custom amount", async () => {
    const event = {
      __body: { amountUsd: 12.5 },
      __headers: {},
    };

    const result = await handler(event as any);

    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        priceAmount: 12.5,
        orderId: "wallet-topup-7",
      })
    );
    expect(result).toEqual({
      invoiceUrl: "https://nowpayments.io/invoice/np-invoice-1",
      invoiceId: "np-invoice-1",
      paymentId: 7,
    });
  });

  it("continues invoice creation when wallet insert conflicts", async () => {
    mocks.findWallet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 21, userId: "user-1", balanceUsd: "0.00" });
    mocks.walletInsertReturning.mockResolvedValueOnce([]);

    const event = {
      __body: { amountUsd: 10 },
      __headers: {},
    };

    const result = await handler(event as any);

    expect(mocks.walletInsertValues).toHaveBeenCalledWith({
      userId: "user-1",
      balanceUsd: "0.00",
    });
    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
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
