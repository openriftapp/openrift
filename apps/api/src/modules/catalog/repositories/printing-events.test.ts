import { describe, expect, it, vi } from "vitest";

import { printingEventsRepo } from "./printing-events.js";

function mockDb() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    onRef: vi.fn().mockReturnThis(),
    execute: vi.fn(async () => []),
  };

  return {
    insertInto: vi.fn(() => chain),
    selectFrom: vi.fn(() => chain),
    updateTable: vi.fn(() => chain),
    chain,
  };
}

describe("printingEventsRepo", () => {
  it.each([
    { method: "markSent", builder: "updateTable", expected: undefined },
    { method: "markRetry", builder: "updateTable", expected: undefined },
    { method: "retryFailed", builder: "updateTable", expected: undefined },
    { method: "listByStatus", builder: "selectFrom", expected: [] },
  ] as const)(
    "$method skips the query for an empty list",
    async ({ method, builder, expected }) => {
      const db = mockDb();
      const repo = printingEventsRepo(db as any);

      expect(await repo[method]([])).toEqual(expected);

      expect(db[builder]).not.toHaveBeenCalled();
    },
  );

  it("listByStatus filters by the provided statuses", async () => {
    const db = mockDb();
    const repo = printingEventsRepo(db as any);

    await repo.listByStatus(["pending", "failed"]);

    expect(db.selectFrom).toHaveBeenCalledWith("printingEvents as pe");
    expect(db.chain.where).toHaveBeenCalledWith("pe.status", "in", ["pending", "failed"]);
  });

  it("retryFailed resets status and retry counter for the supplied ids", async () => {
    const db = mockDb();
    const repo = printingEventsRepo(db as any);

    await repo.retryFailed(["a", "b"]);

    expect(db.updateTable).toHaveBeenCalledWith("printingEvents");
    expect(db.chain.set).toHaveBeenCalledWith({ status: "pending", retryCount: 0 });
    expect(db.chain.where).toHaveBeenCalledWith("id", "in", ["a", "b"]);
  });
});
