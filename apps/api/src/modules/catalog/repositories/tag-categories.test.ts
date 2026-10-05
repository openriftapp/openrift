import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { tagCategoryRepo } from "./tag-categories.js";

const CUSTOM = { table: "customTagCategories", tagTable: "customTags" } as const;

describe("tagCategoryRepo", () => {
  it("deleteById reports whether a row was deleted", async () => {
    await expect(
      tagCategoryRepo(createMockDb({ numDeletedRows: 1n }), CUSTOM).deleteById("c-1"),
    ).resolves.toBe(true);
    await expect(
      tagCategoryRepo(createMockDb({ numDeletedRows: 0n }), CUSTOM).deleteById("c-1"),
    ).resolves.toBe(false);
  });

  it("getMaxSortOrder falls back to -1 for an empty table", async () => {
    const repo = tagCategoryRepo(createMockDb([{ maxSortOrder: null }]), CUSTOM);
    await expect(repo.getMaxSortOrder()).resolves.toBe(-1);
  });

  it("isInUse is true when a tag references the category", async () => {
    await expect(tagCategoryRepo(createMockDb([{ one: 1 }]), CUSTOM).isInUse("c-1")).resolves.toBe(
      true,
    );
    await expect(tagCategoryRepo(createMockDb([]), CUSTOM).isInUse("c-1")).resolves.toBe(false);
  });
});
