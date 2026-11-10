import { beforeEach, describe, expect, it, vi } from "vitest";

const fns = vi.hoisted(() => ({
  unmap: vi.fn((_input: unknown) => Promise.resolve()),
  unignore: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  unmapMarketplacePrintingFn: fns.unmap,
}));
vi.mock("@/features/admin/hooks/use-ignored-products", () => ({
  unignoreProductFn: fns.unignore,
}));

const { assignedListingUndo, ignoredProductUndo, ignoredVariantsUndo, listingName } =
  await import("./listing-undo");

const SKU = { externalId: 42, finish: "foil", language: "EN" };

beforeEach(() => {
  fns.unmap.mockClear();
  fns.unignore.mockClear();
});

describe("listingName", () => {
  it("names the marketplace and each product once", () => {
    expect(listingName("cardmarket", [SKU, { ...SKU, finish: "normal" }])).toBe("Cardmarket #42");
  });
});

describe("ignoredVariantsUndo", () => {
  it("un-ignores every SKU and refreshes the workspace", async () => {
    const entry = ignoredVariantsUndo("tcgplayer", [SKU], "Teemo, Scout");
    expect(entry.label).toBe("Ignored TCGplayer #42 on Teemo, Scout");
    expect(entry.undoneLabel).toBe("Undone: TCGplayer #42 on Teemo, Scout is back in the queue");
    expect(entry.invalidates).toContainEqual(["admin", "workspace"]);

    await entry.undo();

    expect(fns.unignore).toHaveBeenCalledWith({
      data: { level: "variant", marketplace: "tcgplayer", ...SKU },
    });
  });
});

describe("ignoredProductUndo", () => {
  it("un-ignores the whole product", async () => {
    const entry = ignoredProductUndo("cardtrader", 42, "Teemo, Scout");
    expect(entry.label).toBe("Ignored every SKU of CardTrader #42 on Teemo, Scout");

    await entry.undo();

    expect(fns.unignore).toHaveBeenCalledWith({
      data: { level: "product", marketplace: "cardtrader", externalId: 42 },
    });
  });
});

describe("assignedListingUndo", () => {
  it("unmaps the SKU from the printing it was assigned to", async () => {
    const entry = assignedListingUndo("cardmarket", SKU, "p1", "OGN-001");
    expect(entry.label).toBe("Assigned Cardmarket #42 to OGN-001");

    await entry.undo();

    expect(fns.unmap).toHaveBeenCalledWith({
      data: { marketplace: "cardmarket", printingId: "p1", ...SKU },
    });
  });
});
