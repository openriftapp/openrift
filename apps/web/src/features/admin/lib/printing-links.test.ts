import { describe, expect, it } from "vitest";

import { filterPrintingLinks } from "@/features/admin/lib/printing-links";

const PLAYLOL = {
  provider: "playloltcg",
  externalId: "VEN·R06b:foil",
  shortCode: "VEN-R06b",
  cardName: "Vengeful Spirit",
};

const WILDCARD = {
  provider: "",
  externalId: "OGN-197b",
  shortCode: "OGN-197b",
  cardName: "Annie, Fiery",
};

const LINKS = [PLAYLOL, WILDCARD];

describe("filterPrintingLinks", () => {
  it("returns a copy of every row for a blank query", () => {
    const result = filterPrintingLinks(LINKS, "   ");
    expect(result).toEqual(LINKS);
    expect(result).not.toBe(LINKS);
  });

  it("matches the source, external id, short code and card name", () => {
    expect(filterPrintingLinks(LINKS, "playlol")).toEqual([PLAYLOL]);
    expect(filterPrintingLinks(LINKS, "OGN-197b")).toEqual([WILDCARD]);
    expect(filterPrintingLinks(LINKS, "ven-r06b")).toEqual([PLAYLOL]);
    expect(filterPrintingLinks(LINKS, "annie")).toEqual([WILDCARD]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(filterPrintingLinks(LINKS, "  VENGEFUL  ")).toEqual([PLAYLOL]);
  });

  it("returns nothing when no row matches", () => {
    expect(filterPrintingLinks(LINKS, "riftbinder")).toEqual([]);
  });

  it("does not match a wildcard row on the label shown for its empty source", () => {
    expect(filterPrintingLinks(LINKS, "any source")).toEqual([]);
  });
});
