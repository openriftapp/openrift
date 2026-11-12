import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { cardResolutionKey, resolveDeckCheckCards } from "./deck-check-card-resolution.js";

const CARDS = [
  { id: "c-annie", slug: "annie", name: "Annie", types: ["unit"], tags: [] },
  {
    id: "c-annie-dark",
    slug: "annie-dark-child",
    name: "Annie, Dark Child",
    types: ["unit"],
    tags: [],
  },
  {
    id: "c-azir",
    slug: "emperor-of-the-sands",
    name: "Emperor of the Sands",
    types: ["legend"],
    tags: ["Azir"],
  },
  { id: "c-dorans", slug: "dorans-shield", name: "Doran’s Shield", types: ["gear"], tags: [] },
  {
    id: "c-mf-buccaneer",
    slug: "miss-fortune-buccaneer",
    name: "Miss Fortune, Buccaneer",
    types: ["unit"],
    tags: ["Miss Fortune"],
  },
  {
    id: "c-mf-bounty",
    slug: "bounty-hunter",
    name: "Bounty Hunter",
    types: ["legend"],
    tags: ["Miss Fortune"],
  },
];

const CODES = [{ cardId: "c-annie", shortCode: "OGN-001", publicCode: "OGN-001/298" }];

/** Each call builds its own repos double so the per-`Repos` index memo starts cold. */
function makeRepos() {
  const cards = vi.fn().mockResolvedValue(CARDS);
  const nameAliases = vi.fn().mockResolvedValue([{ cardId: "c-dorans", normName: "missfortune" }]);
  const canonicalPrintingByCard = vi
    .fn()
    .mockImplementation((ids: string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, `p-${id}`]))),
    );
  const repos = {
    catalog: {
      cards,
      printingLookupRows: vi.fn().mockResolvedValue(CODES),
      nameAliases,
      catalogContentVersion: vi.fn().mockResolvedValue("catalog-v1"),
    },
    deckCheck: { canonicalPrintingByCard },
  } as unknown as Repos;
  return { repos, cards, canonicalPrintingByCard, nameAliases };
}

describe("resolveDeckCheckCards", () => {
  it("matches an exact name and attaches its canonical printing", async () => {
    const { repos } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Annie" }]);

    expect(results.get(cardResolutionKey("Annie"))).toEqual({
      resolvedCardId: "c-annie",
      resolvedPrintingId: "p-c-annie",
      matchStatus: "matched",
    });
  });

  it("matches a Legend written in its colloquial champion form", async () => {
    const { repos } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Azir, Emperor of the Sands" }]);

    expect(results.get(cardResolutionKey("Azir, Emperor of the Sands"))?.resolvedCardId).toBe(
      "c-azir",
    );
  });

  it("leaves a bare champion name to the cards it fits, never to an aliased card", async () => {
    const { repos, nameAliases } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Miss Fortune" }]);

    expect(results.get(cardResolutionKey("Miss Fortune"))).toEqual({
      resolvedCardId: null,
      resolvedPrintingId: null,
      matchStatus: "ambiguous",
    });
    expect(nameAliases).not.toHaveBeenCalled();
  });

  it("matches across typographic punctuation the player cannot type", async () => {
    const { repos } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Doran's Shield" }]);

    expect(results.get(cardResolutionKey("Doran's Shield"))?.resolvedCardId).toBe("c-dorans");
  });

  it("reports a tie as ambiguous rather than picking one", async () => {
    const { repos } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Anni" }]);

    expect(results.get(cardResolutionKey("Anni"))).toEqual({
      resolvedCardId: null,
      resolvedPrintingId: null,
      matchStatus: "ambiguous",
    });
  });

  it("reports an unknown name as unmatched", async () => {
    const { repos } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [{ name: "Teemo" }]);

    expect(results.get(cardResolutionKey("Teemo"))).toEqual({
      resolvedCardId: null,
      resolvedPrintingId: null,
      matchStatus: "unmatched",
    });
  });

  it("resolves repeated spellings of one name once", async () => {
    const { repos, canonicalPrintingByCard } = makeRepos();

    const results = await resolveDeckCheckCards(repos, [
      { name: "Annie" },
      { name: "annie" },
      { name: "ANNIE" },
    ]);

    expect(results.size).toBe(1);
    expect(canonicalPrintingByCard).toHaveBeenCalledWith(["c-annie"]);
  });

  it("returns an empty map for no inputs without touching the catalogue", async () => {
    const { repos, cards } = makeRepos();

    expect(await resolveDeckCheckCards(repos, [])).toEqual(new Map());
    expect(cards).not.toHaveBeenCalled();
  });

  it("builds the index once for a batch", async () => {
    const { repos, cards } = makeRepos();

    await resolveDeckCheckCards(repos, [
      { name: "Annie" },
      { name: "Emperor of the Sands" },
      { name: "Teemo" },
    ]);

    expect(cards).toHaveBeenCalledTimes(1);
  });
});
