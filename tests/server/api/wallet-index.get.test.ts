import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findWallet: vi.fn(),
  walletInsertValues: vi.fn(),
  walletInsertReturning: vi.fn(),
  dbInsert: vi.fn(),
}));

vi.mock("~~/server/utils/session", () => ({
  requireUserSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("~~/server/utils/drizzle", () => ({
  useDrizzle: () => ({
    query: {
      wallet: {
        findFirst: mocks.findWallet,
      },
    },
    insert: mocks.dbInsert,
  }),
}));

vi.mock("~~/db/schema", () => ({
  wallet: { id: "wallet.id", userId: "wallet.userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left, right) => ({ left, right })),
}));

import handler from "~~/server/api/wallet/index.get";

describe("Wallet index API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findWallet.mockResolvedValue({
      id: 21,
      userId: "user-1",
      balanceUsd: "5.25",
    });
    mocks.walletInsertReturning.mockResolvedValue([]);
    mocks.walletInsertValues.mockReturnValue({
      onConflictDoNothing: vi.fn(() => ({
        returning: mocks.walletInsertReturning,
      })),
    });
    mocks.dbInsert.mockImplementation((table: any) => {
      if (table?.id === "wallet.id") {
        return { values: mocks.walletInsertValues };
      }
      throw new Error("Unexpected table in db.insert");
    });
  });

  it("returns existing wallet balance", async () => {
    const result = await handler({} as any);
    expect(result).toEqual({ balanceUsd: 5.25 });
  });

  it("returns balance when wallet insert conflicts with concurrent request", async () => {
    mocks.findWallet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 21,
        userId: "user-1",
        balanceUsd: "0.00",
      });

    const result = await handler({} as any);

    expect(mocks.walletInsertValues).toHaveBeenCalledWith({
      userId: "user-1",
      balanceUsd: "0.00",
    });
    expect(result).toEqual({ balanceUsd: 0 });
  });
});
