import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    paymentStatus: "pending" as "pending" | "finished",
    transactionInserts: 0,
    walletUpdates: 0,
  },
  validateIpnSignature: vi.fn(() => true),
  findPayment: vi.fn(),
  dbTransaction: vi.fn(),
}));

const mockTx = {
  update: vi.fn((table: any) => {
    if (table?.id === "nowPayment.id") {
      return {
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (mocks.state.paymentStatus === "finished") {
                return [];
              }
              mocks.state.paymentStatus = "finished";
              return [{ id: 1, walletId: 9, amountUsd: "10.00" }];
            }),
          })),
        })),
      };
    }

    if (table?.id === "wallet.id") {
      return {
        set: vi.fn(() => ({
          where: vi.fn(async () => {
            mocks.state.walletUpdates += 1;
          }),
        })),
      };
    }

    throw new Error("Unexpected table in tx.update");
  }),
  query: {
    wallet: {
      findFirst: vi.fn(async () => ({ id: 9, balanceUsd: "5.00" })),
    },
    transaction: {
      findFirst: vi.fn(async () => null),
    },
  },
  insert: vi.fn(() => ({
    values: vi.fn(async () => {
      mocks.state.transactionInserts += 1;
    }),
  })),
};

vi.mock("~~/server/utils/drizzle", () => ({
  useDrizzle: () => ({
    query: {
      nowPayment: {
        findFirst: mocks.findPayment,
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    transaction: vi.fn(async (fn: any) => fn(mockTx)),
  }),
}));

vi.mock("~~/server/utils/nowpayments", () => ({
  validateIpnSignature: mocks.validateIpnSignature,
}));

vi.mock("~~/db/schema", () => ({
  nowPayment: { id: "nowPayment.id", status: "nowPayment.status", walletId: "nowPayment.walletId", amountUsd: "nowPayment.amountUsd" },
  wallet: { id: "wallet.id" },
  transaction: { referenceId: "transaction.referenceId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left, right) => ({ left, right })),
  and: vi.fn((...args) => args),
  ne: vi.fn((left, right) => ({ left, right })),
}));

import handler from "~~/server/api/nowpayments/webhook.post";

describe("NOWPayments webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.paymentStatus = "pending";
    mocks.state.transactionInserts = 0;
    mocks.state.walletUpdates = 0;

    mocks.findPayment.mockImplementation(async () => ({
      id: 1,
      walletId: 9,
      amountUsd: "10.00",
      status: mocks.state.paymentStatus,
      metadata: {},
    }));
  });

  it("credits wallet once when duplicate finished webhook is delivered", async () => {
    const event = {
      __headers: { "x-nowpayments-sig": "valid-signature" },
      __body: {
        order_id: "wallet-topup-1",
        payment_status: "finished",
        payment_id: 111,
        pay_currency: "btc",
        pay_amount: 0.0001,
        actually_paid: 0.0001,
        outcome_amount: 10,
        pay_address: "addr",
        purchase_id: "purchase-1",
      },
    };

    const firstResult = await handler(event as any);
    const secondResult = await handler(event as any);

    expect(firstResult.processed).toBe(true);
    expect(secondResult.reason).toBe("already_processed");
    expect(mocks.state.transactionInserts).toBe(1);
    expect(mocks.state.walletUpdates).toBe(1);
  });

  it("rejects webhook with invalid signature", async () => {
    mocks.validateIpnSignature.mockReturnValueOnce(false);

    const event = {
      __headers: { "x-nowpayments-sig": "bad-signature" },
      __body: {
        order_id: "wallet-topup-1",
        payment_status: "finished",
      },
    };

    await expect(handler(event as any)).rejects.toThrow("Invalid IPN signature");
    expect(mocks.state.transactionInserts).toBe(0);
  });
});
