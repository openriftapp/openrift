import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { collectionsRepo } from "./collections.js";

describe("collectionsRepo", () => {
  it("deleteByIdForUser reports whether a row was deleted", async () => {
    const repo = collectionsRepo(createMockDb([{ numDeletedRows: 1n }]));
    await expect(repo.deleteByIdForUser("col-1", "u1")).resolves.toBe(true);
    const none = collectionsRepo(createMockDb([{ numDeletedRows: 0n }]));
    await expect(none.deleteByIdForUser("col-1", "u1")).resolves.toBe(false);
  });

  it("deleteById reports whether a row was deleted", async () => {
    const repo = collectionsRepo(createMockDb([{ numDeletedRows: 1n }]));
    await expect(repo.deleteById("col-1")).resolves.toBe(true);
  });
});
