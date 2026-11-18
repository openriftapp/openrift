import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { marketplaceAdminRepo } from "./marketplace-admin.js";

describe("marketplaceAdminRepo", () => {
  it("updateGroup returns true when name is updated", async () => {
    const db = createMockDb([{ numUpdatedRows: 1n }]);
    expect(await marketplaceAdminRepo(db).updateGroup("tcgplayer", 1, { name: "New Name" })).toBe(
      true,
    );
  });

  it("updateGroup returns true when groupKind is updated", async () => {
    const db = createMockDb([{ numUpdatedRows: 1n }]);
    expect(
      await marketplaceAdminRepo(db).updateGroup("tcgplayer", 1, { groupKind: "special" }),
    ).toBe(true);
  });

  it.each([
    { name: "assigned", setId: "019cfc3b-0389-744b-837c-792fd586300e" },
    { name: "cleared to null", setId: null },
  ])("updateGroup returns true when setId is $name", async ({ setId }) => {
    const db = createMockDb([{ numUpdatedRows: 1n }]);
    expect(await marketplaceAdminRepo(db).updateGroup("tcgplayer", 1, { setId })).toBe(true);
  });

  it("updateGroup returns false when not found", async () => {
    const db = createMockDb([]);
    expect(await marketplaceAdminRepo(db).updateGroup("tcgplayer", 999, { name: null })).toBe(
      false,
    );
  });

  it("updateGroup returns false when patch is empty", async () => {
    const db = createMockDb([{ numUpdatedRows: 1n }]);
    expect(await marketplaceAdminRepo(db).updateGroup("tcgplayer", 1, {})).toBe(false);
  });

  it("deleteIgnoredVariants returns 0 for empty input", async () => {
    const db = createMockDb([{ numDeletedRows: 3n }]);
    expect(await marketplaceAdminRepo(db).deleteIgnoredVariants("tcgplayer", [])).toBe(0);
  });

  it("upsertStagingCardOverride throws when the product does not exist", async () => {
    const db = createMockDb([]);
    await expect(
      marketplaceAdminRepo(db).upsertStagingCardOverride({
        marketplace: "tcgplayer",
        externalId: 999,
        finish: "normal",
        language: "EN",
        cardId: "c-1",
      }),
    ).rejects.toThrow("no marketplace_products row");
  });
});
