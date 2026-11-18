import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { userSharesRepo } from "./user-shares.js";

const LIST = {
  id: "lst-1",
  userId: "u1",
  name: "Wants",
  intent: "wish" as const,
  kind: "card" as const,
  isPublic: false,
  shareToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("userSharesRepo", () => {
  it.each([
    { entryCount: 3, expected: 3 },
    { entryCount: null, expected: 0 },
  ])(
    "listsForOwner maps an entryCount of $entryCount to $expected with no viaGroups for an anonymous viewer",
    async ({ entryCount, expected }) => {
      const db = createMockDb([{ ...LIST, entryCount }]);
      const repo = userSharesRepo(db);
      expect(await repo.listsForOwner("u1", null)).toEqual([
        { list: LIST, entryCount: expected, viaGroups: [] },
      ]);
    },
  );
});
