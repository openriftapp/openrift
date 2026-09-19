import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import {
  META_FRONT_SECTION_LIMITS,
  metaEventWinners,
  metaFrontSectionQuery,
  metaFrontSectionShown,
  metaFrontUpcomingQuery,
} from "@/features/meta/lib/meta-front-page";

function event(overrides: Partial<MetaEventSummary> = {}): MetaEventSummary {
  return {
    id: "evt-1",
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    eventDate: "2026-08-15",
    format: "constructed",
    tier: "local",
    status: "complete",
    country: "DE",
    location: "Rift Games, Berlin",
    playerCount: 32,
    organizer: "Rift Games Berlin",
    playerRowCount: 32,
    deckCount: 4,
    topFinishes: [],
    ...overrides,
  };
}

const WINNER = {
  rank: 1,
  rankIsTier: false,
  playerName: "Nova",
  playerKey: "u2001",
  wins: 6,
  losses: 1,
  draws: 0,
  legend: {
    cardId: "legend-1",
    name: "Kennen, Heart of the Tempest",
    slug: "kennen",
    imageId: null,
    domains: ["chaos", "order"],
    archiveSlug: "kennen-kennen",
  },
};

describe("metaEventWinners", () => {
  it("names every player the source placed first, and nobody below", () => {
    const winners = metaEventWinners(
      event({
        topFinishes: [WINNER, { ...WINNER, playerName: "Ekko" }, { ...WINNER, rank: 2 }],
      }),
    );

    expect(winners.map((finish) => finish.playerName)).toEqual(["Nova", "Ekko"]);
  });

  it("names nobody for an event whose standings have not arrived", () => {
    expect(metaEventWinners(event())).toEqual([]);
  });
});

describe("metaFrontSectionQuery", () => {
  it("asks for one tier's newest events that hold standings", () => {
    expect(metaFrontSectionQuery({ from: "2026-01-01" }, "premier")).toEqual({
      from: "2026-01-01",
      tiers: ["premier"],
      tiersEx: undefined,
      holds: "standings",
      by: "date",
      dir: "desc",
      limit: META_FRONT_SECTION_LIMITS.premier,
    });
  });

  it("asks for its own tier, whatever the scope bar picked", () => {
    const query = metaFrontSectionQuery({ tiers: ["local"], tiersEx: ["premier"] }, "competitive");

    expect(query.tiers).toEqual(["competitive"]);
    expect(query.tiersEx).toBeUndefined();
  });

  it("narrows to decklists when that is all the reader asked for", () => {
    expect(metaFrontSectionQuery({ holds: "decks" }, "local").holds).toBe("decks");
  });
});

describe("metaFrontSectionShown", () => {
  it("shows every tier while the scope picks none", () => {
    expect(metaFrontSectionShown({}, "premier")).toBe(true);
    expect(metaFrontSectionShown({ from: "2026-01-01" }, "local")).toBe(true);
  });

  it("shows only the tiers the scope includes", () => {
    expect(metaFrontSectionShown({ tiers: ["premier"] }, "premier")).toBe(true);
    expect(metaFrontSectionShown({ tiers: ["premier"] }, "local")).toBe(false);
  });

  it("drops a tier the scope excludes", () => {
    expect(metaFrontSectionShown({ tiersEx: ["local"] }, "local")).toBe(false);
    expect(metaFrontSectionShown({ tiersEx: ["local"] }, "competitive")).toBe(true);
  });
});

describe("metaFrontUpcomingQuery", () => {
  it("asks for what is still to come, soonest first", () => {
    expect(metaFrontUpcomingQuery({ holds: "decks", q: "worlds" })).toEqual({
      q: "worlds",
      holds: "upcoming",
      by: "date",
      dir: "asc",
      limit: META_FRONT_SECTION_LIMITS.upcoming,
    });
  });
});
