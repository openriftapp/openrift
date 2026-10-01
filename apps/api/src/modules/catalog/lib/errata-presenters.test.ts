import { describe, expect, it } from "vitest";

import { buildErrataListResponse } from "./errata-presenters.js";

type EntryRow = Parameters<typeof buildErrataListResponse>[1][number];

const ANNOUNCEMENT = {
  id: "a-1",
  name: "Vendetta Errata Updates",
  publishedOn: "2026-07-23",
  url: "https://example.invalid/vendetta",
};

function row(overrides: Partial<EntryRow> = {}): EntryRow {
  return {
    announcementId: "a-1",
    correctedRulesText: "Draw 2.",
    correctedEffectText: null,
    source: null,
    sourceUrl: null,
    effectiveDate: null,
    slug: "astral-heron",
    name: "Astral Heron",
    tags: [],
    types: ["Unit"],
    domains: ["Calm"],
    shortCode: "VEN-044",
    printedRulesText: "Draw 1.",
    printedEffectText: null,
    setSlug: "VEN",
    setName: "Vendetta",
    setSortOrder: 6,
    imageId: "img-1",
    ...overrides,
  };
}

describe("buildErrataListResponse", () => {
  it("maps an announced entry with its printing", () => {
    const response = buildErrataListResponse([ANNOUNCEMENT], [row()]);
    expect(response.announcements).toEqual([ANNOUNCEMENT]);
    expect(response.entries).toEqual([
      {
        announcementId: "a-1",
        source: null,
        sourceUrl: null,
        effectiveDate: null,
        correctedRulesText: "Draw 2.",
        correctedEffectText: null,
        card: {
          slug: "astral-heron",
          name: "Astral Heron",
          types: ["Unit"],
          tags: [],
          domains: ["Calm"],
        },
        printing: {
          shortCode: "VEN-044",
          setSlug: "VEN",
          printedRulesText: "Draw 1.",
          printedEffectText: null,
          imageId: "img-1",
        },
      },
    ]);
  });

  it("returns a null printing when the card has no English printing", () => {
    const response = buildErrataListResponse(
      [],
      [row({ shortCode: null, setSlug: null, setName: null, setSortOrder: null, imageId: null })],
    );
    expect(response.entries[0]?.printing).toBeNull();
    expect(response.sets).toEqual([]);
  });

  it("lists each referenced set once, in catalogue order", () => {
    const response = buildErrataListResponse(
      [],
      [
        row({ setSlug: "VEN", setName: "Vendetta", setSortOrder: 6 }),
        row({ slug: "gold", setSlug: "OGN", setName: "Origins", setSortOrder: 3 }),
        row({ slug: "arise", setSlug: "VEN", setName: "Vendetta", setSortOrder: 6 }),
      ],
    );
    expect(response.sets).toEqual([
      { slug: "OGN", name: "Origins" },
      { slug: "VEN", name: "Vendetta" },
    ]);
  });
});
