import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { scanReportsRepo } from "./scan-reports.js";

describe("scanReportsRepo", () => {
  it("countRecentByUser returns the counted rows", async () => {
    const db = createMockDb([{ count: "3" }]);
    const repo = scanReportsRepo(db);
    expect(await repo.countRecentByUser("u1", new Date(0))).toBe(3);
  });

  it("countRecentByUser reports zero when the query returns nothing", async () => {
    const db = createMockDb([]);
    const repo = scanReportsRepo(db);
    expect(await repo.countRecentByUser("u1", new Date(0))).toBe(0);
  });

  it.each([
    { name: "true when a row carries", rows: [{ id: "sr-1" }], expected: true },
    { name: "false when no row carries", rows: [], expected: false },
  ])("referenceExists is $name the reference", async ({ rows, expected }) => {
    const db = createMockDb(rows);
    const repo = scanReportsRepo(db);
    expect(await repo.referenceExists("SC-ABCD")).toBe(expected);
  });
});
