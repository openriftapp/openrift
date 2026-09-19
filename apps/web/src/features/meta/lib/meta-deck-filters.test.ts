import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import type { MetaDeckFilterValues } from "./meta-deck-filters";
import {
  filterDecksByCost,
  groupDecksByEvent,
  hasActiveMetaDeckFilters,
  metaDeckQueryFromFilters,
  nextDeckSort,
  sortMetaDecks,
} from "./meta-deck-filters";
import type { MetaEra } from "./meta-scope";
import { ERA_ALL, ERA_CUSTOM } from "./meta-scope";

const ERAS: MetaEra[] = [
  { id: "vendetta", label: "Vendetta", from: "2026-08-01", to: null },
  { id: "origins", label: "Origins", from: "2026-01-01", to: "2026-07-31" },
];

const EMPTY: MetaDeckFilterValues = {
  scope: { era: ERA_ALL, formats: [], tiers: [] },
  events: [],
  legends: [],
  maxRank: null,
  maxCost: null,
  valueMin: null,
  valueMax: null,
};

const COSTS = new Map([
  ["a", { needed: 40, owned: 40, value: 120, toComplete: 0 }],
  ["b", { needed: 40, owned: 20, value: 60, toComplete: 25 }],
  ["c", { needed: 40, owned: 0, value: undefined, toComplete: undefined }],
]);

const COST_EMPTY = { maxCost: null, valueMin: null, valueMax: null };

function makeDeck(overrides: Partial<MetaDeckSummary> = {}): MetaDeckSummary {
  const event = {
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    eventDate: "2026-08-01",
    format: "standard",
    tier: "premier" as const,
    country: "DE",
    ...overrides.event,
  };
  return {
    playerId: "player-1",
    deckId: "deck-1",
    shareToken: "token000001",
    listStatus: "full",
    name: "Fury Aggro",
    format: event.format,
    legendCardId: "card-jinx",
    legendName: "Jinx, Loose Cannon",
    legendSlug: "jinx-loose-cannon",
    legendArchiveSlug: null,
    legendImageId: "img-jinx",
    championCardId: "card-jinx-champ",
    championName: "Jinx, Loose Cannon",
    championImageId: "img-jinx-champ",
    playerName: "Ashen",
    playerKey: "u6001",
    rank: 1,
    rankIsTier: false,
    wins: 6,
    losses: 1,
    draws: null,
    ...overrides,
    event,
  };
}

const decks: MetaDeckSummary[] = [
  makeDeck({ deckId: "a", playerName: "Ashen", rank: 1 }),
  makeDeck({
    deckId: "b",
    playerName: "Bram",
    rank: 4,
    legendCardId: "card-lux",
    legendName: "Lux",
  }),
  makeDeck({
    deckId: "c",
    playerName: "Cyra",
    rank: 8,
    legendCardId: null,
    legendName: null,
    event: {
      slug: "rift-open",
      name: "Rift Open",
      eventDate: "2026-06-15",
      format: "legacy",
      tier: "local",
      country: "FR",
    },
  }),
];

const ids = (result: MetaDeckSummary[]) => result.map((deck) => deck.deckId);

describe("groupDecksByEvent", () => {
  const riftOpen = { ...decks[0]!.event, slug: "rift-open", name: "Rift Open" };

  it("gathers each event's consecutive lists under that event", () => {
    const groups = groupDecksByEvent([
      makeDeck({ deckId: "s1" }),
      makeDeck({ deckId: "s2" }),
      makeDeck({ deckId: "r1", event: riftOpen }),
    ]);

    expect(groups.map((group) => [group.event.slug, ids(group.decks)])).toEqual([
      ["summoner-skirmish", ["s1", "s2"]],
      ["rift-open", ["r1"]],
    ]);
  });

  it("opens a new group when an event returns after another one", () => {
    const groups = groupDecksByEvent([
      makeDeck({ deckId: "s1" }),
      makeDeck({ deckId: "r1", event: riftOpen }),
      makeDeck({ deckId: "s2" }),
    ]);

    expect(groups.map((group) => group.event.slug)).toEqual([
      "summoner-skirmish",
      "rift-open",
      "summoner-skirmish",
    ]);
  });
});

describe("sortMetaDecks", () => {
  it("orders by event date desc, then finish, then player", () => {
    const shuffled = [decks[2]!, decks[1]!, decks[0]!];
    expect(ids(sortMetaDecks(shuffled))).toEqual(["a", "b", "c"]);
  });

  it("keeps same-day events together", () => {
    const sameDay = { ...decks[0]!.event, slug: "rift-open", name: "Rift Open" };
    const interleaved = [
      makeDeck({ deckId: "s1", rank: 1 }),
      makeDeck({ deckId: "r1", rank: 1, event: sameDay }),
      makeDeck({ deckId: "s2", rank: 2 }),
      makeDeck({ deckId: "r2", rank: 2, event: sameDay }),
    ];
    expect(ids(sortMetaDecks(interleaved))).toEqual(["r1", "r2", "s1", "s2"]);
  });

  it("breaks a rank tie on player name", () => {
    const tied = [
      makeDeck({ deckId: "z", playerName: "Zed", rank: 4 }),
      makeDeck({ deckId: "m", playerName: "Mel", rank: 4 }),
    ];
    expect(ids(sortMetaDecks(tied))).toEqual(["m", "z"]);
  });

  it("runs the dates the other way when asked", () => {
    expect(ids(sortMetaDecks(decks, "date", "asc"))).toEqual(["c", "a", "b"]);
  });

  it("orders by finish across events, newest first on a tie", () => {
    const rows = [
      makeDeck({ deckId: "old-1", rank: 1, event: decks[2]!.event }),
      makeDeck({ deckId: "new-4", rank: 4 }),
      makeDeck({ deckId: "new-1", rank: 1 }),
    ];
    expect(ids(sortMetaDecks(rows, "finish", "asc"))).toEqual(["new-1", "old-1", "new-4"]);
    expect(ids(sortMetaDecks(rows, "finish", "desc"))).toEqual(["new-4", "new-1", "old-1"]);
  });

  it("orders by cost to complete with unpriced lists last either way", () => {
    expect(ids(sortMetaDecks(decks, "cost", "asc", COSTS))).toEqual(["a", "b", "c"]);
    expect(ids(sortMetaDecks(decks, "cost", "desc", COSTS))).toEqual(["b", "a", "c"]);
  });

  it("orders by value with unpriced lists last either way", () => {
    expect(ids(sortMetaDecks(decks, "value", "asc", COSTS))).toEqual(["b", "a", "c"]);
    expect(ids(sortMetaDecks(decks, "value", "desc", COSTS))).toEqual(["a", "b", "c"]);
  });

  it("falls back to the date order before any cost is known", () => {
    expect(ids(sortMetaDecks(decks, "cost", "asc"))).toEqual(["a", "b", "c"]);
  });
});

describe("nextDeckSort", () => {
  it("flips the direction of the column already sorted by", () => {
    expect(nextDeckSort({ sort: "date", direction: "desc" }, "date")).toEqual({
      sort: "date",
      direction: "asc",
    });
  });

  it("opens a new column on newest, best or cheapest first", () => {
    expect(nextDeckSort({ sort: "finish", direction: "asc" }, "date")).toEqual({
      sort: "date",
      direction: "desc",
    });
    expect(nextDeckSort({ sort: "date", direction: "desc" }, "cost")).toEqual({
      sort: "cost",
      direction: "asc",
    });
  });
});
describe("filterDecksByCost", () => {
  it("keeps only the lists completable within the bound", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, maxCost: 25 }, COSTS))).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats a bound of zero as the lists the reader can build now", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, maxCost: 0 }, COSTS))).toEqual(["a"]);
  });

  it("drops a list whose completion cannot be costed", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, maxCost: 1000 }, COSTS))).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps the page while no costs have loaded, rather than emptying a shared link", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, maxCost: 0 }, undefined))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ignores the costs while no bound is set", () => {
    expect(ids(filterDecksByCost(decks, COST_EMPTY, COSTS))).toEqual(["a", "b", "c"]);
  });

  it("treats both value bounds as inclusive", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, valueMin: 60 }, COSTS))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, valueMax: 60 }, COSTS))).toEqual(["b"]);
    expect(
      ids(filterDecksByCost(decks, { ...COST_EMPTY, valueMin: 61, valueMax: 200 }, COSTS)),
    ).toEqual(["a"]);
  });

  it("drops a list whose value is unknown once a bound is set", () => {
    expect(ids(filterDecksByCost(decks, { ...COST_EMPTY, valueMin: 0 }, COSTS))).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("metaDeckQueryFromFilters", () => {
  const STATE = { events: [], legends: [], maxRank: null, showAll: false };

  it("curates and holds the default facets while nothing is narrowed", () => {
    expect(metaDeckQueryFromFilters({ ...STATE, scope: { era: ERA_ALL } }, ERAS)).toEqual({
      formats: ["constructed"],
      tiers: ["premier", "competitive"],
      curated: true,
    });
  });

  it("carries every populated axis and drops the curation once the reader opens the archive", () => {
    expect(
      metaDeckQueryFromFilters(
        {
          events: ["rift-open"],
          legends: ["card-lux"],
          maxRank: 8,
          showAll: true,
          scope: { era: ERA_ALL, formats: ["standard"], tiers: ["local"] },
        },
        ERAS,
      ),
    ).toEqual({
      formats: ["standard"],
      tiers: ["local"],
      events: ["rift-open"],
      legends: ["card-lux"],
      maxRank: 8,
    });
  });

  it("resolves a set era to its own window", () => {
    const query = metaDeckQueryFromFilters({ ...STATE, scope: { era: "origins" } }, ERAS);
    expect(query.from).toBe("2026-01-01");
    expect(query.to).toBe("2026-07-31");
  });

  it("carries a custom range as the reader set it", () => {
    const query = metaDeckQueryFromFilters(
      { ...STATE, scope: { era: ERA_CUSTOM, from: "2026-07-01", to: "2026-08-31" } },
      ERAS,
    );
    expect(query.from).toBe("2026-07-01");
    expect(query.to).toBe("2026-08-31");
  });
});

describe("hasActiveMetaDeckFilters", () => {
  it("is false for the default state", () => {
    expect(hasActiveMetaDeckFilters({ ...EMPTY, scope: {} })).toBe(false);
  });

  it("is true once the reader opens the scope past its default", () => {
    expect(hasActiveMetaDeckFilters(EMPTY)).toBe(true);
  });

  it("is true once any axis is populated", () => {
    expect(
      hasActiveMetaDeckFilters({ ...EMPTY, scope: { ...EMPTY.scope, tiers: ["premier"] } }),
    ).toBe(true);
    expect(hasActiveMetaDeckFilters({ ...EMPTY, maxRank: 8 })).toBe(true);
    expect(hasActiveMetaDeckFilters({ ...EMPTY, maxCost: 0 })).toBe(true);
    expect(hasActiveMetaDeckFilters({ ...EMPTY, valueMin: 5 })).toBe(true);
    expect(hasActiveMetaDeckFilters({ ...EMPTY, valueMax: 5 })).toBe(true);
    expect(hasActiveMetaDeckFilters({ ...EMPTY, events: ["rift-open"] })).toBe(true);
  });
});
