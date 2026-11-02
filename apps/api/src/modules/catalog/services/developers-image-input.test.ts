import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import { buildDevelopersImageInput } from "./developers-image-input.js";

function card(name: string, overrides: Record<string, unknown> = {}) {
  return {
    slug: name.toLowerCase(),
    name,
    types: ["unit"],
    domains: ["fury"],
    energy: 5,
    tags: [name],
    ...overrides,
  };
}

function printing(cardId: string, publicCode: string, overrides: Record<string, unknown> = {}) {
  return {
    cardId,
    publicCode,
    language: "EN",
    images: [{ imageId: `img-${publicCode}` }],
    printedRulesText: `Rules of ${publicCode}`,
    ...overrides,
  };
}

function catalog(
  cards: Record<string, unknown>,
  printings: Record<string, unknown>,
  setCount = 2,
): CatalogResponse {
  return {
    sets: Array.from({ length: setCount }, (_, index) => ({ id: `set-${index}` })),
    cards,
    printings,
  } as unknown as CatalogResponse;
}

describe("buildDevelopersImageInput", () => {
  it("uses the showcase printing, its card fields and the two backdrops", () => {
    const input = buildDevelopersImageInput(
      catalog(
        {
          annie: card("Annie, Fiery", { tags: ["Annie", "Noxus"] }),
          garen: card("Garen"),
          teemo: card("Teemo"),
        },
        {
          p1: printing("garen", "OGS-007/024"),
          p2: printing("annie", "OGS-001/024"),
          p3: printing("teemo", "OGN-197/298"),
          p4: printing("annie", "OGS-001/024", { language: "FR", images: [{ imageId: "img-fr" }] }),
        },
      ),
      "openrift.app",
    );

    expect(input).toEqual({
      showcase: {
        imageId: "img-OGS-001/024",
        name: "Annie, Fiery",
        energy: 5,
        tags: ["Annie", "Noxus"],
        domains: ["fury"],
        rulesText: "Rules of OGS-001/024",
        publicCode: "OGS-001/024",
      },
      backdropImageIds: ["img-OGS-007/024", "img-OGN-197/298"],
      stats: { cards: 3, printings: 4, sets: 2, languages: 2 },
      siteHost: "openrift.app",
    });
  });

  it("falls back to the first English unit with art and energy when the showcase is missing", () => {
    const input = buildDevelopersImageInput(
      catalog(
        {
          spell: card("Abandon", { types: ["spell"] }),
          noEnergy: card("Battlefield", { energy: null }),
          jinx: card("Jinx"),
        },
        {
          p1: printing("spell", "OGN-001/298"),
          p2: printing("noEnergy", "OGN-002/298"),
          p3: printing("jinx", "OGN-003/298", { images: [] }),
          p4: printing("jinx", "OGN-004/298"),
        },
      ),
    );

    expect(input.showcase?.publicCode).toBe("OGN-004/298");
    expect(input.backdropImageIds).toEqual([]);
    expect(input.siteHost).toBeUndefined();
  });

  it("has no showcase when no printing qualifies", () => {
    const input = buildDevelopersImageInput(catalog({}, {}, 0));

    expect(input.showcase).toBeNull();
    expect(input.stats).toEqual({ cards: 0, printings: 0, sets: 0, languages: 0 });
  });
});
