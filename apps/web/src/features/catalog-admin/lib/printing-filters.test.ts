import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRINTING_FILTERS,
  filterPrintings,
  printingLanguages,
  printingSets,
} from "@/features/catalog-admin/lib/printing-filters";
import { makeAdminPrinting } from "@/test/factories";

const enBase = makeAdminPrinting({ shortCode: "OGN-001", language: "EN" });
const scBase = makeAdminPrinting({ shortCode: "OGN-001", language: "SC" });
const enPromo = makeAdminPrinting({
  shortCode: "OGN-001",
  language: "EN",
  markerSlugs: ["prerelease"],
  setSlug: "prm",
  setName: "Promos",
});

describe("printingLanguages", () => {
  it("lists each language once, sorted", () => {
    expect(printingLanguages([scBase, enBase, enPromo])).toEqual(["EN", "SC"]);
  });
});

describe("printingSets", () => {
  it("lists each set once with its name", () => {
    expect(printingSets([enBase, scBase, enPromo])).toEqual([
      { slug: "ogn", name: "Origins" },
      { slug: "prm", name: "Promos" },
    ]);
  });

  it("falls back to the slug when the set has no name", () => {
    const unnamed = makeAdminPrinting({ setSlug: "unk", setName: null });
    expect(printingSets([unnamed])).toEqual([{ slug: "unk", name: "unk" }]);
  });
});

describe("filterPrintings", () => {
  const all = [enBase, scBase, enPromo];

  it("keeps everything by default", () => {
    expect(filterPrintings(all, DEFAULT_PRINTING_FILTERS)).toHaveLength(3);
  });

  it("filters by language", () => {
    const result = filterPrintings(all, { ...DEFAULT_PRINTING_FILTERS, language: "SC" });
    expect(result).toEqual([scBase]);
  });

  it("filters by set", () => {
    const result = filterPrintings(all, { ...DEFAULT_PRINTING_FILTERS, setSlug: "prm" });
    expect(result).toEqual([enPromo]);
  });

  it("filters to printings with markers", () => {
    const result = filterPrintings(all, { ...DEFAULT_PRINTING_FILTERS, markers: "with" });
    expect(result).toEqual([enPromo]);
  });

  it("filters to printings without markers", () => {
    const result = filterPrintings(all, { ...DEFAULT_PRINTING_FILTERS, markers: "without" });
    expect(result).toEqual([enBase, scBase]);
  });

  it("combines language and marker filters", () => {
    const result = filterPrintings(all, {
      language: "EN",
      setSlug: null,
      markers: "without",
    });
    expect(result).toEqual([enBase]);
  });
});
