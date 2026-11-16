import { describe, expect, it } from "vitest";

import type { Repos } from "../../../deps.js";
import { factsFor, sourceEventFacts, sourceStandings } from "./meta-promote-sources.js";

const CONTEXT = {
  formatMappings: new Map<string, string>(),
  templateTiers: new Map(),
  competitivePlayerFloor: 128,
};

const STANDINGS = [
  {
    playerKey: 7,
    playerName: "Jinx",
    rank: 1,
    wins: 3,
    losses: 0,
    draws: 1,
    legendName: "Jinx, Loose Cannon",
    sourceDeckId: "deck-7",
  },
  {
    playerKey: 9,
    playerName: "Vi",
    rank: null,
    wins: 0,
    losses: 0,
    draws: 0,
    legendName: null,
    sourceDeckId: null,
  },
];

function reposFor(): Repos {
  const listing = {
    name: "Summoner Skirmish",
    startAt: new Date("2026-10-18T02:00:00Z"),
    shopName: "Piltover Hobbies",
    address: "1 Hextech Way",
    playerCount: 16,
    format: "constructed",
    longitude: 0,
    country: "US",
  };
  const results = { standings: () => Promise.resolve(STANDINGS) };
  const events = { byKey: () => Promise.resolve(listing) };
  return {
    playloltcgEvents: events,
    playloltcgResults: results,
    topdeckEvents: events,
    topdeckResults: results,
  } as unknown as Repos;
}

function expected(identity: string, provider: string) {
  return [
    {
      identity,
      unkeyedIdentity: expect.any(String),
      uvsgamesPlayerId: null,
      playerName: "Jinx",
      rank: 1,
      rankIsTier: false,
      wins: 3,
      losses: 0,
      draws: 1,
      matchPoints: null,
      opponentMatchWinPct: null,
      gameWinPct: null,
      opponentGameWinPct: null,
      entryStatus: null,
      legendName: "Jinx, Loose Cannon",
      sourceDeckId: "deck-7",
      provider,
    },
  ];
}

describe("keyed source standings", () => {
  it("reads ranked playloltcg standings under the p prefix", async () => {
    const facts = await factsFor(reposFor(), "playloltcg", "42", CONTEXT);

    expect(facts?.standings).toEqual(expected("p7", "playloltcg"));
  });

  it("reads ranked topdeck standings under the t prefix", async () => {
    const facts = await factsFor(reposFor(), "topdeck", "tid-1", CONTEXT);

    expect(facts?.standings).toEqual(expected("t7", "topdeck"));
  });
});

function uvsgamesRepos(byKey: () => Promise<unknown>): Repos {
  return {
    uvsgamesEvents: {
      byKey,
      formatMappings: () => Promise.resolve(new Map()),
      templateTiers: () => Promise.resolve(new Map()),
      settings: () => Promise.resolve({ competitivePlayerFloor: 128 }),
    },
    uvsgamesResults: { standings: () => Promise.resolve([]) },
  } as unknown as Repos;
}

const UNMAPPED_LISTING = {
  name: "Summoner Skirmish",
  eventFormat: "Arena Brawl",
  startAt: new Date("2026-10-18T02:00:00Z"),
  timezone: null,
  playerCount: 16,
  location: null,
  storeName: null,
  eventConfigurationTemplate: null,
};

describe("source reads for the admin views", () => {
  it("reads an unmapped format as no facts and no standings", async () => {
    const repos = uvsgamesRepos(() => Promise.resolve(UNMAPPED_LISTING));

    await expect(sourceEventFacts(repos, "uvsgames", "e-1")).resolves.toBeNull();
    await expect(sourceStandings(repos, "uvsgames", "e-1")).resolves.toEqual([]);
  });

  it("lets a database failure through", async () => {
    const repos = uvsgamesRepos(() => Promise.reject(new Error("connection terminated")));

    await expect(sourceEventFacts(repos, "uvsgames", "e-1")).rejects.toThrow(
      "connection terminated",
    );
    await expect(sourceStandings(repos, "uvsgames", "e-1")).rejects.toThrow(
      "connection terminated",
    );
  });
});
