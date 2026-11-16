import {
  makeCatalogCard,
  makeCatalogPrinting,
  makeCatalogReference,
} from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { boosterCoverCards, boosterRowsFor } from "./booster-index.js";

function catalog(withEpic: boolean): CatalogResponse {
  const { id: unitId, ...unit } = makeCatalogCard({ id: "unit" });
  const { id: runeId, ...rune } = makeCatalogCard({ id: "rune", types: ["rune"] });
  const entries = [
    makeCatalogPrinting({ printingId: "common", cardId: unitId, rarity: "common" }),
    makeCatalogPrinting({ printingId: "uncommon", cardId: unitId, rarity: "uncommon" }),
    makeCatalogPrinting({ printingId: "foil", cardId: unitId, finish: "foil" }),
    makeCatalogPrinting({ printingId: "rare", cardId: unitId, rarity: "rare", finish: "foil" }),
    makeCatalogPrinting({ printingId: "rune", cardId: runeId }),
    ...(withEpic
      ? [
          makeCatalogPrinting({
            printingId: "epic",
            cardId: unitId,
            rarity: "epic",
            finish: "foil",
            images: [{ imageId: "img-epic" }],
          }),
        ]
      : []),
  ];
  return {
    sets: [{ id: "set-1", slug: "OGN", name: "Origins", releases: {}, setType: "main" }],
    cards: { [unitId]: unit, [runeId]: rune },
    printings: Object.fromEntries(
      entries.map(({ printingId, side: _side, ...value }) => [printingId, value]),
    ),
    ...makeCatalogReference(),
  };
}

function reposFor(current: () => Promise<{ version: string; value: CatalogResponse }>): Repos {
  return { catalogResponse: { current } } as unknown as Repos;
}

describe("boosterRowsFor", () => {
  it("returns a printing's rows from the booster of its set", async () => {
    const repos = reposFor(() => Promise.resolve({ version: "v1", value: catalog(true) }));
    const rows = await boosterRowsFor(repos, ["epic", "missing"]);
    expect(rows).toEqual([
      expect.objectContaining({
        printingId: "epic",
        slot: "foil",
        outcome: "foil-epic",
        outcomePerPack: 0.01,
        basis: "guess",
      }),
      expect.objectContaining({
        printingId: "epic",
        booster: "origins-booster-pack",
        slot: "rare",
        outcome: "epic",
        outcomePerPack: 0.25,
        poolSize: 1,
        basis: "official",
      }),
    ]);
  });

  it("rebuilds when the catalog response version moves", async () => {
    const current = vi
      .fn()
      .mockResolvedValueOnce({ version: "v1", value: catalog(false) })
      .mockResolvedValueOnce({ version: "v1", value: catalog(false) })
      .mockResolvedValue({ version: "v2", value: catalog(true) });
    const repos = reposFor(current);
    expect(await boosterRowsFor(repos, ["epic"])).toEqual([]);
    expect(await boosterRowsFor(repos, ["epic"])).toEqual([]);
    expect(await boosterRowsFor(repos, ["epic"])).toHaveLength(2);
  });

  it("covers a booster with its English pack's alt arts, then Epics, that have an image", async () => {
    const repos = reposFor(() => Promise.resolve({ version: "v1", value: catalog(true) }));
    expect(await boosterCoverCards(repos)).toEqual({
      "origins-booster-pack": [{ printingId: "epic", imageId: "img-epic", name: "Test Card" }],
    });
  });
});
