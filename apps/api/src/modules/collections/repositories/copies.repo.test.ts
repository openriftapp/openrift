import { describe, expect, it } from "vitest";

import { AppError } from "../../../errors.js";
import { createMockDb } from "../../../test/mock-db.js";
import { copiesRepo } from "./copies.js";

describe("copiesRepo", () => {
  it("listForAccessibleCollections rejects an unparseable cursor with a 400 AppError instead of an Invalid Date reaching the query", () => {
    const db = createMockDb([]);
    const repo = copiesRepo(db);
    expect(() => repo.listForAccessibleCollections("u1", 20, "not-a-date")).toThrow(AppError);
    try {
      void repo.listForAccessibleCollections("u1", 20, "not-a-date");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(400);
    }
  });

  it("filterAccessibleByViewer returns matching ids", async () => {
    const db = createMockDb([{ id: "cp-1" }]);
    const repo = copiesRepo(db);
    expect(await repo.filterAccessibleByViewer(["cp-1"], "u1")).toEqual(["cp-1"]);
  });

  it("listByIdsInCollections issues no query for an empty id or collection list", async () => {
    const db = createMockDb([{ id: "cp-1" }]);
    const repo = copiesRepo(db);
    expect(await repo.listByIdsInCollections([], ["col-1"])).toEqual([]);
    expect(await repo.listByIdsInCollections(["cp-1"], [])).toEqual([]);
  });

  it("ownedRowsForUser short-circuits on an empty printing scope without querying", async () => {
    const db = createMockDb([{ copyId: "cp-1" }]);
    expect(await copiesRepo(db).ownedRowsForUser("u1", [])).toEqual([]);
  });
});
