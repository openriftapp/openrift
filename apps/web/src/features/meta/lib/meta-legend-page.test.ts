import type { MetaLegendFinish, MetaLegendSummary } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import {
  metaLegendCountries,
  metaScopedCountries,
  nextLegendSort,
  searchMetaLegendEntries,
  sortMetaLegendEntries,
} from "@/features/meta/lib/meta-legend-page";
import { ERA_ALL } from "@/features/meta/lib/meta-scope";

type FinishOverrides = Partial<Omit<MetaLegendFinish, "event">> & {
  event?: Partial<MetaLegendFinish["event"]>;
};

function finish({ event, ...overrides }: FinishOverrides = {}): MetaLegendFinish {
  return {
    playerId: "p1",
    rank: 1,
    rankIsTier: false,
    playerName: "Renata",
    playerKey: "u5001",
    wins: 12,
    losses: 1,
    draws: 0,
    shareToken: null,
    listStatus: "none",
    ...overrides,
    event: {
      slug: "summoner-skirmish",
      name: "Summoner Skirmish",
      eventDate: "2026-08-01",
      format: "constructed",
      tier: "local",
      country: "DE",
      playerCount: 64,
      ...event,
    },
  };
}

function legendSummary(
  name: string,
  slug: string,
  overrides: Partial<Omit<MetaLegendSummary, "slug" | "legend">> = {},
): MetaLegendSummary {
  return {
    slug,
    legend: { cardId: slug, name, slug, imageId: null, domains: [], archiveSlug: slug },
    bestFinish: {
      rank: 8,
      rankIsTier: false,
      event: {
        slug: "summoner-skirmish",
        name: "Summoner Skirmish",
        eventDate: "2026-08-01",
        format: "constructed",
        tier: "local",
        country: "DE",
        playerCount: 64,
      },
    },
    finishes: 1,
    decklists: 0,
    eventWins: 0,
    ...overrides,
  };
}

function bestFinish(rank: number, eventDate: string): MetaLegendSummary["bestFinish"] {
  const base = legendSummary("x", "x").bestFinish;
  return { ...base, rank, event: { ...base.event, eventDate } };
}

describe("metaLegendCountries", () => {
  it("offers each country the record covers once, alphabetically", () => {
    expect(
      metaLegendCountries([
        finish({ playerId: "a", event: { country: "it" } }),
        finish({ playerId: "b", event: { country: "AT" } }),
        finish({ playerId: "c", event: { country: "IT" } }),
      ]),
    ).toEqual(["AT", "IT"]);
  });

  it("offers nothing for events no source gave a venue", () => {
    expect(
      metaLegendCountries([
        finish({ playerId: "a", event: { country: null } }),
        finish({ playerId: "b", event: { country: "??" } }),
      ]),
    ).toEqual([]);
  });

  it("offers nothing for an empty record", () => {
    expect(metaLegendCountries([])).toEqual([]);
  });
});

describe("metaScopedCountries", () => {
  it("offers the countries the rows on screen name", () => {
    expect(
      metaScopedCountries([finish({ event: { country: "FR" } })], { era: ERA_ALL, formats: [] }),
    ).toEqual(["FR"]);
  });

  it("still offers a country the scope picked, so the reader can pick it back off", () => {
    expect(
      metaScopedCountries([finish({ event: { country: "FR" } })], { countries: ["fr", "jp"] }),
    ).toEqual(["FR", "JP"]);
  });

  it("offers an excluded country too", () => {
    expect(metaScopedCountries([], { countriesEx: ["DE"] })).toEqual(["DE"]);
  });

  it("offers nothing when neither the rows nor the scope name a country", () => {
    expect(metaScopedCountries([], {})).toEqual([]);
  });
});

describe("searchMetaLegendEntries", () => {
  const entries = [
    legendSummary("Kennen, Heart of the Tempest", "kennen"),
    legendSummary("Azir, Emperor of the Sands", "azir"),
    legendSummary("Doran’s Shield", "doran"),
  ];

  it("keeps every entry when the box is empty or blank", () => {
    expect(searchMetaLegendEntries(entries)).toHaveLength(3);
    expect(searchMetaLegendEntries(entries, "   ")).toHaveLength(3);
  });

  it("matches the name a reader sees, ignoring case", () => {
    expect(searchMetaLegendEntries(entries, "kenn").map((entry) => entry.slug)).toEqual(["kennen"]);
    expect(searchMetaLegendEntries(entries, "SANDS").map((entry) => entry.slug)).toEqual(["azir"]);
  });

  it("finds a name stored with a typographic apostrophe from a typed one", () => {
    expect(searchMetaLegendEntries(entries, "Doran's").map((entry) => entry.slug)).toEqual([
      "doran",
    ]);
  });

  it("leaves the caller's array alone", () => {
    const input = [...entries];
    searchMetaLegendEntries(input, "kenn");
    expect(input).toEqual(entries);
  });
});

describe("sortMetaLegendEntries", () => {
  const kennen = legendSummary("Kennen, Heart of the Tempest", "kennen", {
    bestFinish: bestFinish(4, "2026-08-15"),
    finishes: 9,
    decklists: 1,
  });
  const azir = legendSummary("Azir, Emperor of the Sands", "azir", {
    bestFinish: bestFinish(1, "2026-02-01"),
    finishes: 2,
    decklists: 5,
    eventWins: 1,
  });

  it("orders by the champion-led name by default and flips with the direction", () => {
    const entries = [kennen, azir];
    expect(sortMetaLegendEntries(entries).map((entry) => entry.slug)).toEqual(["azir", "kennen"]);
    expect(sortMetaLegendEntries(entries, "name", "desc").map((entry) => entry.slug)).toEqual([
      "kennen",
      "azir",
    ]);
  });

  it("orders best placings first, the newest of an equal placing ahead", () => {
    const viktor = legendSummary("Viktor, Herald of the Arcane", "viktor", {
      bestFinish: bestFinish(1, "2026-08-15"),
    });
    const sorted = sortMetaLegendEntries([kennen, azir, viktor], "best", "asc");
    expect(sorted.map((entry) => entry.slug)).toEqual(["viktor", "azir", "kennen"]);
  });

  it("orders the count columns with a name tiebreak", () => {
    const entries = [kennen, azir];
    expect(sortMetaLegendEntries(entries, "decklists", "desc")[0]!.slug).toBe("azir");
    expect(sortMetaLegendEntries(entries, "finishes", "desc")[0]!.slug).toBe("kennen");
    const tied = [
      legendSummary("Kennen, Heart of the Tempest", "kennen", { finishes: 3 }),
      legendSummary("Azir, Emperor of the Sands", "azir", { finishes: 3 }),
    ];
    expect(sortMetaLegendEntries(tied, "finishes", "desc").map((entry) => entry.slug)).toEqual([
      "azir",
      "kennen",
    ]);
  });

  it("leaves the caller's array alone", () => {
    const entries = [kennen, azir];
    const input = [...entries];
    sortMetaLegendEntries(input, "best", "asc");
    expect(input).toEqual(entries);
  });
});

describe("nextLegendSort", () => {
  it("flips the direction on the active column", () => {
    expect(nextLegendSort({ sort: "name", direction: "asc" }, "name")).toEqual({
      sort: "name",
      direction: "desc",
    });
  });

  it("starts a new column at its most interesting order", () => {
    const from = { sort: "name", direction: "asc" } as const;
    expect(nextLegendSort(from, "best")).toEqual({ sort: "best", direction: "asc" });
    expect(nextLegendSort(from, "decklists")).toEqual({ sort: "decklists", direction: "desc" });
    expect(nextLegendSort(from, "finishes")).toEqual({ sort: "finishes", direction: "desc" });
  });
});
