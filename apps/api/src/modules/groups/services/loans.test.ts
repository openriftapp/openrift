import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { createLoan, reopenBorrowerReturn } from "./loans.js";

function mockTransact(trxRepos: Repos): Transact {
  return (fn) => fn(trxRepos) as any;
}

function reposWithPinError(error: unknown): Repos {
  return {
    copies: {
      lockByIds: vi.fn(async (ids: string[]) => ids),
    },
    loans: {
      printingCardId: vi.fn(async () => "card-1"),
      listUnclaimedCopyIds: vi.fn(async () => ["copy-1", "copy-2"]),
      create: vi.fn(async () => ({ id: "loan-1" })),
      pinCopies: vi.fn(async () => {
        throw error;
      }),
    },
    cardTrades: {
      filterReservedCopyIds: vi.fn(async () => []),
    },
  } as unknown as Repos;
}

const INPUT = {
  lenderUserId: "lender-1",
  printingId: "printing-1",
  quantity: 1,
  borrowerName: "Ashe",
};

describe("createLoan copy-pin race", () => {
  it("maps a unique-violation on pinCopies to a 409, not a raw 500", async () => {
    const repos = reposWithPinError({ code: "23505" });
    const result = await createLoan(mockTransact(repos), INPUT).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).status).toBe(409);
  });

  it("re-throws a non-unique error unchanged", async () => {
    const boom = new Error("connection reset");
    const repos = reposWithPinError(boom);
    await expect(createLoan(mockTransact(repos), INPUT)).rejects.toBe(boom);
  });
});

describe("createLoan cross-claim with a concurrent trade accept", () => {
  it("409s and never creates the loan or pins when the locked copy was reserved by a trade after the unclaimed read", async () => {
    const create = vi.fn(async () => ({ id: "loan-1" }));
    const pinCopies = vi.fn(async () => undefined);
    const repos = {
      copies: {
        lockByIds: vi.fn(async (ids: string[]) => ids),
      },
      loans: {
        printingCardId: vi.fn(async () => "card-1"),
        listUnclaimedCopyIds: vi.fn(async () => ["copy-1"]),
        create,
        pinCopies,
      },
      cardTrades: {
        filterReservedCopyIds: vi.fn(async () => ["copy-1"]),
      },
    } as unknown as Repos;

    const result = await createLoan(mockTransact(repos), INPUT).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).status).toBe(409);
    expect(create).not.toHaveBeenCalled();
    expect(pinCopies).not.toHaveBeenCalled();
  });
});

function dtoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "loan-1",
    lenderUserId: "lender-1",
    borrowerUserId: "borrower-1",
    borrowerName: null,
    printingId: "printing-1",
    cardId: "card-1",
    quantity: 2,
    returnedQuantity: 0,
    borrowerReturnedQuantity: 0,
    status: "active",
    acknowledgedAt: null,
    rejectedAt: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    closedAt: null,
    lenderName: "Ekko",
    lenderImage: null,
    lenderEmail: "ekko@example.com",
    borrowerUserName: "Jinx",
    borrowerUserImage: null,
    borrowerUserEmail: "jinx@example.com",
    ...overrides,
  };
}

describe("reopenBorrowerReturn re-pinning", () => {
  it("pins the declared count, skipping copies a trade reserved in the meantime", async () => {
    const pinCopies = vi.fn(async () => undefined);
    const repos = {
      copies: {
        lockByIds: vi.fn(async (ids: string[]) => ids),
      },
      loans: {
        getById: vi.fn(async () => ({
          id: "loan-1",
          lenderUserId: "lender-1",
          printingId: "printing-1",
          borrowerReturnedQuantity: 2,
        })),
        undoBorrowerReturn: vi.fn(async () => 1),
        listUnclaimedCopyIds: vi.fn(async () => ["copy-1", "copy-2", "copy-3", "copy-4"]),
        pinCopies,
        getDtoRowByIdForUser: vi.fn(async () => dtoRow({ quantity: 2 })),
      },
      cardTrades: {
        filterReservedCopyIds: vi.fn(async () => ["copy-1"]),
      },
    } as unknown as Repos;

    await reopenBorrowerReturn(mockTransact(repos), "loan-1", "lender-1");

    expect(pinCopies).toHaveBeenCalledWith("loan-1", ["copy-2", "copy-3"]);
  });

  it("reopens with fewer pins when the released copies are gone", async () => {
    const pinCopies = vi.fn(async () => undefined);
    const repos = {
      copies: {
        lockByIds: vi.fn(async () => []),
      },
      loans: {
        getById: vi.fn(async () => ({
          id: "loan-1",
          lenderUserId: "lender-1",
          printingId: "printing-1",
          borrowerReturnedQuantity: 2,
        })),
        undoBorrowerReturn: vi.fn(async () => 1),
        listUnclaimedCopyIds: vi.fn(async () => ["copy-1"]),
        pinCopies,
        getDtoRowByIdForUser: vi.fn(async () => dtoRow()),
      },
      cardTrades: {
        filterReservedCopyIds: vi.fn(async () => []),
      },
    } as unknown as Repos;

    const result = await reopenBorrowerReturn(mockTransact(repos), "loan-1", "lender-1");

    expect(result.status).toBe("active");
    expect(pinCopies).toHaveBeenCalledWith("loan-1", []);
  });

  it("409s when there is no declared return to undo", async () => {
    const undoBorrowerReturn = vi.fn(async () => 1);
    const repos = {
      loans: {
        getById: vi.fn(async () => ({
          id: "loan-1",
          lenderUserId: "lender-1",
          printingId: "printing-1",
          borrowerReturnedQuantity: 0,
        })),
        undoBorrowerReturn,
      },
    } as unknown as Repos;

    const result = await reopenBorrowerReturn(mockTransact(repos), "loan-1", "lender-1").catch(
      (error: unknown) => error,
    );

    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).status).toBe(409);
    expect(undoBorrowerReturn).not.toHaveBeenCalled();
  });
});
