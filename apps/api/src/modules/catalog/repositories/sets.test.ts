import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { setsRepo } from "./sets.js";

describe("setsRepo", () => {
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

  it("getNamesByIds skips the query when ids is empty", async () => {
    const db = createMockDb([{ id: "s-1", name: "Origins" }]);
    const result = await setsRepo(db).getNamesByIds([]);
    expect(result.size).toBe(0);
  });

  it("deleteById deletes a set", async () => {
    const db = createMockDb({ numDeletedRows: 1n });
    await expect(setsRepo(db).deleteById("s-1")).resolves.toBe(true);
  });
});
