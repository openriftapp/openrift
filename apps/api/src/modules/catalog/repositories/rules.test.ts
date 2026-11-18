import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { rulesRepo } from "./rules.js";

describe("rulesRepo", () => {
  describe("insertRules", () => {
    const rule = {
      kind: "core" as const,
      language: "en" as const,
      version: "1.0",
      ruleNumber: "100.1",
      sortOrder: 1,
      depth: 0,
      ruleType: "text" as const,
      content: "A rule.",
      changeType: "added" as const,
    };

    it.each([
      {
        name: "one result counting every row",
        results: [{ numInsertedOrUpdatedRows: 3n }],
        rows: 3,
        expected: 3,
      },
      {
        name: "several results",
        results: [{ numInsertedOrUpdatedRows: 2n }, { numInsertedOrUpdatedRows: 1n }],
        rows: 3,
        expected: 3,
      },
      { name: "a result without numInsertedOrUpdatedRows", results: [{}], rows: 1, expected: 0 },
    ])("sums numInsertedOrUpdatedRows over $name", async ({ results, rows, expected }) => {
      const db = createMockDb(results);
      expect(await rulesRepo(db).insertRules(Array.from({ length: rows }, () => rule))).toBe(
        expected,
      );
    });
  });
});
