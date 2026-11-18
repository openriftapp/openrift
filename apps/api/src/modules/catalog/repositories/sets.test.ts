import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { setsRepo } from "./sets.js";

const SET = {
  id: "s-1",
  slug: "OGS",
  name: "Proving Grounds",
  printedTotal: 200,
  releasedAt: "2025-01-01",
  sortOrder: 1,
};

describe("setsRepo", () => {
  it("listAll returns all sets", async () => {
    const db = createMockDb([SET]);
    expect(await setsRepo(db).listAll()).toEqual([SET]);
  });

  it("getBySlug returns id when found", async () => {
    const db = createMockDb([{ id: "s-1" }]);
    expect(await setsRepo(db).getBySlug("OGS")).toEqual({ id: "s-1" });
  });

  it("getPrintedTotal returns total", async () => {
    const db = createMockDb([{ printedTotal: 200 }]);
    expect(await setsRepo(db).getPrintedTotal("s-1")).toEqual({ printedTotal: 200 });
  });

  it("getNamesByIds returns a map of id to name", async () => {
    const db = createMockDb([
      { id: "s-1", name: "Origins" },
      { id: "s-2", name: "Unleashed" },
    ]);
    const result = await setsRepo(db).getNamesByIds(["s-1", "s-2"]);
    expect(result).toEqual(
      new Map([
        ["s-1", "Origins"],
        ["s-2", "Unleashed"],
      ]),
    );
  });

  it("getNamesByIds returns an empty map when ids is empty", async () => {
    const db = createMockDb([]);
    const result = await setsRepo(db).getNamesByIds([]);
    expect(result.size).toBe(0);
  });

  it("createIfNotExists returns id when inserted", async () => {
    const db = createMockDb([{ id: "s-new" }]);
    expect(
      await setsRepo(db).createIfNotExists({
        slug: "NEW",
        name: "New Set",
        printedTotal: null,
        setType: "main",
      }),
    ).toBe("s-new");
  });

  it("createIfNotExists returns null when slug exists", async () => {
    const db = createMockDb([]);
    expect(
      await setsRepo(db).createIfNotExists({
        slug: "OGS",
        name: "Proving Grounds",
        printedTotal: null,
        setType: "main",
      }),
    ).toBeNull();
  });

  it("update returns true when row updated", async () => {
    const db = createMockDb([{ numUpdatedRows: 1n }]);
    expect(
      await setsRepo(db).update("s-1", {
        name: "Updated",
        printedTotal: 200,
        setType: "main",
      }),
    ).toBe(true);
  });

  it("update returns false when row not found", async () => {
    const db = createMockDb([]);
    expect(
      await setsRepo(db).update("s-1", {
        name: "Updated",
        printedTotal: null,
        setType: "main",
      }),
    ).toBe(false);
  });

  it("deleteById deletes a set", async () => {
    const db = createMockDb({ numDeletedRows: 1n });
    await expect(setsRepo(db).deleteById("s-1")).resolves.toBe(true);
  });

  it("cardCount returns count", async () => {
    const db = createMockDb([{ count: 42 }]);
    expect(await setsRepo(db).cardCount("s-1")).toBe(42);
  });

  it("printingCount returns count", async () => {
    const db = createMockDb([{ count: 100 }]);
    expect(await setsRepo(db).printingCount("s-1")).toBe(100);
  });

  it("cardCountsBySet returns counts per set", async () => {
    const db = createMockDb([{ setId: "s-1", cardCount: 42 }]);
    expect(await setsRepo(db).cardCountsBySet()).toHaveLength(1);
  });

  it("printingCountsBySet returns counts per set", async () => {
    const db = createMockDb([{ setId: "s-1", printingCount: 100 }]);
    expect(await setsRepo(db).printingCountsBySet()).toHaveLength(1);
  });
});
