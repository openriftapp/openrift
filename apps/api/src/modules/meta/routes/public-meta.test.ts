import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { metaRouter } from "./public-meta";

const mockMeta = {
  eventIndex: vi.fn(),
  eventFacetCounts: vi.fn(),
  eventHoldingsCounts: vi.fn(),
  eventTotals: vi.fn(),
  eventsBySlugs: vi.fn(),
  eventRowsByIds: vi.fn(),
  topFinishesForEvents: vi.fn(),
  recentActivity: vi.fn(),
  eventBySlug: vi.fn(),
  standingsPage: vi.fn(),
  standingsRowsByIds: vi.fn(),
  standingsRowByKey: vi.fn(),
  bestPerLegendForEvent: vi.fn(),
  cutLineRowForEvent: vi.fn(),
  fieldSummaryForEvent: vi.fn(),
  matchesForPlayers: vi.fn(),
  matchesInPhases: vi.fn(),
  phasesForEvent: vi.fn(),
  sourcesForEvent: vi.fn(),
  contributorsForEvent: vi.fn(),
  playerCountInScope: vi.fn(),
  deckCountInScope: vi.fn(),
  allDeckSummaries: vi.fn(),
  deckFacetCounts: vi.fn(),
  allDeckCards: vi.fn(),
  archiveLegends: vi.fn(),
  scopedLegendRecords: vi.fn(),
  scopedLegendCount: vi.fn(),
  scopedLegendCountries: vi.fn(),
  finishesForLegend: vi.fn(),
  bestFinishesForLegend: vi.fn(),
  legendRecordCounts: vi.fn(),
  eventTierCounts: vi.fn(),
  finishesForPlayer: vi.fn(),
};

const NO_TIER_COUNTS = { premier: 0, competitive: 0, local: 0 };

const NO_FIELD = {
  withLists: 0,
  hasLegends: false,
  hasRecords: false,
  hasRuns: false,
  legends: [],
  progress: null,
};

function standingsPage(rows: Record<string, unknown>[], total = rows.length) {
  return { rows, total };
}

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "m0000000-0000-4000-a000-000000000001",
    metaEventId: EVENT_ID,
    phaseOrder: 0,
    roundNumber: 1,
    tableNumber: 4,
    isBye: false,
    isDraw: false,
    player1Id: "p0000000-0001-4000-a000-000000000001",
    player2Id: "p0000000-0001-4000-a000-000000000002",
    winnerId: "p0000000-0001-4000-a000-000000000001",
    gamesWonP1: 2,
    gamesWonP2: 1,
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    updatedAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  };
}

function phaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "h0000000-0000-4000-a000-000000000001",
    metaEventId: EVENT_ID,
    phaseOrder: 0,
    name: "Phase 1",
    roundType: "SWISS",
    roundCount: 8,
    rankRequired: null,
    maxGameWins: 2,
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    updatedAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  };
}

function cutPhaseRow() {
  return phaseRow({
    id: "h0000000-0000-4000-a000-000000000002",
    phaseOrder: 1,
    name: "Phase 3",
    roundType: "RANKED_SINGLE_ELIMINATION",
    roundCount: 3,
    rankRequired: 8,
  });
}

const mockCanonicalPrintings = { resolvePrintingMetaForRows: vi.fn() };

const mockMetaSubmissions = { pendingForEvent: vi.fn() };

let viewer: { id: string } | null = null;

const EVENT_ID = "b0000000-0001-4000-a000-000000000001";
const LEGEND_ID = "f0000000-0001-4000-a000-000000000001";
const CHAMPION_ID = "f0000000-0001-4000-a000-000000000002";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    meta: mockMeta,
    canonicalPrintings: mockCanonicalPrintings,
    metaSubmissions: mockMetaSubmissions,
  } as never);
  c.set("user", viewer as never);
  await next();
});
registerRouterForTest(app, metaRouter);

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    slug: "summoner-skirmish-2026",
    name: "Summoner Skirmish",
    eventDate: "2026-08-01",
    format: "constructed",
    playerCount: 64,
    organizer: "LGS Berlin",
    notes: "Top 8 lists only.",
    tier: "local",
    country: "DE",
    location: "Kartenstraße 1, 10115 Berlin, DE",
    status: "complete",
    sourceCheckedAt: null,
    playerRowCount: 0,
    deckCount: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function playerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p0000000-0001-4000-a000-000000000001",
    rank: 1,
    rankIsTier: false,
    playerName: "Renata",
    sourceIdentity: "u347713",
    wins: 5,
    losses: 1,
    draws: 0,
    legendCardId: null,
    legendName: null,
    legendSlug: null,
    legendTypes: null,
    legendTags: null,
    legendDomains: null,
    championCardId: null,
    championName: null,
    championSlug: null,
    championDomains: null,
    deckId: null,
    deckName: null,
    shareToken: null,
    listStatus: "none",
    ...overrides,
  };
}

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c0000000-0001-4000-a000-000000000001",
    metaEventId: EVENT_ID,
    provider: "uvsgames",
    externalId: "evt-1",
    label: "uvsgames",
    sourceUrl: "https://example.invalid/uvs",
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockMeta.topFinishesForEvents.mockResolvedValue([]);
  mockMeta.recentActivity.mockResolvedValue([]);
  mockMeta.standingsPage.mockResolvedValue({ rows: [], total: 0 });
  mockMeta.standingsRowsByIds.mockResolvedValue([]);
  mockMeta.standingsRowByKey.mockResolvedValue(undefined);
  mockMeta.bestPerLegendForEvent.mockResolvedValue([]);
  mockMeta.cutLineRowForEvent.mockResolvedValue(undefined);
  mockMeta.fieldSummaryForEvent.mockResolvedValue(NO_FIELD);
  mockMeta.matchesForPlayers.mockResolvedValue([]);
  mockMeta.matchesInPhases.mockResolvedValue([]);
  mockMeta.phasesForEvent.mockResolvedValue([]);
  mockMeta.sourcesForEvent.mockResolvedValue([]);
  mockMeta.contributorsForEvent.mockResolvedValue([]);
  mockMeta.allDeckSummaries.mockResolvedValue({
    rows: [],
    total: 0,
    eventCount: 0,
    archiveTotal: 0,
  });
  mockMeta.deckFacetCounts.mockResolvedValue({
    events: [],
    legends: [],
    finishes: [],
    countries: [],
  });
  mockMeta.allDeckCards.mockResolvedValue([]);
  mockMeta.archiveLegends.mockResolvedValue([]);
  mockMeta.scopedLegendRecords.mockResolvedValue([]);
  mockMeta.scopedLegendCount.mockResolvedValue(0);
  mockMeta.scopedLegendCountries.mockResolvedValue([]);
  mockMeta.eventIndex.mockResolvedValue({ rows: [], total: 0 });
  mockMeta.eventRowsByIds.mockResolvedValue([]);
  mockMeta.eventsBySlugs.mockResolvedValue([]);
  mockMeta.finishesForLegend.mockResolvedValue({ rows: [], total: 0 });
  mockMeta.bestFinishesForLegend.mockResolvedValue([]);
  mockMeta.legendRecordCounts.mockResolvedValue({ wins: 0, finishes: 0, decklists: 0 });
  mockMeta.eventTierCounts.mockResolvedValue(NO_TIER_COUNTS);
  mockMeta.finishesForPlayer.mockResolvedValue([]);
  mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([]);
});

describe("GET /meta/events/{slug}", () => {
  it("prints every citation in the order the repo returned them", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.sourcesForEvent.mockResolvedValue([
      sourceRow(),
      sourceRow({
        id: "c0000000-0001-4000-a000-000000000002",
        provider: null,
        externalId: null,
        label: "Twitch VOD",
        sourceUrl: "https://example.invalid/vod",
      }),
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.event.sources.map((s: { label: string }) => s.label)).toEqual([
      "uvsgames",
      "Twitch VOD",
    ]);
    expect(json.event.sourceUrl).toBeUndefined();
  });

  it("names each contributor once, resolved, with no user id on the wire", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.contributorsForEvent.mockResolvedValue([
      { metaEventId: EVENT_ID, userId: "user-7", displayName: "Skarner Fan" },
      { metaEventId: EVENT_ID, userId: "user-9", displayName: "Ziggs Enjoyer" },
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(json.event.contributors).toEqual(["Skarner Fan", "Ziggs Enjoyer"]);
    expect(JSON.stringify(json.event)).not.toContain("user-7");
  });

  it("shows no contributor line when everyone who helped is hidden", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(json.event.contributors).toEqual([]);
    expect(json.event.sources).toEqual([]);
  });

  it("returns the first page of the standings, deckless entries included", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow({ playerRowCount: 3, deckCount: 1 }));
    mockMeta.standingsPage.mockResolvedValue(
      standingsPage([
        playerRow({
          deckId: "d0000000-0001-4000-a000-000000000001",
          deckName: "Renata Control",
          shareToken: "tok-1",
          listStatus: "full",
        }),
        playerRow({ id: "p0000000-0001-4000-a000-000000000002", rank: 2, playerName: "Ekko" }),
        playerRow({
          id: "p0000000-0001-4000-a000-000000000003",
          rank: 3,
          playerName: "Jinx",
          wins: null,
          losses: null,
          draws: null,
        }),
      ]),
    );

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.standings.players).toHaveLength(3);
    expect(json.standings.total).toBe(3);
    expect(json.standings.players[0]).toMatchObject({
      deckId: "d0000000-0001-4000-a000-000000000001",
      deckName: "Renata Control",
      shareToken: "tok-1",
      listStatus: "full",
    });
    expect(json.standings.players[1]).toMatchObject({
      playerName: "Ekko",
      deckId: null,
      shareToken: null,
      listStatus: "none",
    });
    expect(json.standings.players[2]).toMatchObject({ wins: null, losses: null, draws: null });
    expect(json.event.playerRowCount).toBe(3);
    expect(json.event.deckCount).toBe(1);
  });

  it("asks for one page and no more, however long the field", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow({ playerRowCount: 2054 }));

    await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    expect(mockMeta.standingsPage).toHaveBeenCalledWith(EVENT_ID, {}, { limit: 200, offset: 0 });
  });

  it("states what the page says about the whole field, not about the page", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.fieldSummaryForEvent.mockResolvedValue({
      withLists: 38,
      hasLegends: true,
      hasRecords: true,
      hasRuns: true,
      legends: [{ cardId: LEGEND_ID, name: "Azir", count: 12 }],
      progress: { phaseOrder: 1, roundNumber: 2 },
    });
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);
    mockMeta.cutLineRowForEvent.mockResolvedValue(playerRow({ wins: 11, losses: 2, draws: 1 }));

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(json.field).toMatchObject({
      withLists: 38,
      hasLegends: true,
      hasRecords: true,
      hasRuns: true,
      legends: [{ cardId: LEGEND_ID, name: "Azir", count: 12 }],
      cutLine: { wins: 11, losses: 2, draws: 1 },
      progress: { phaseOrder: 1, roundNumber: 2 },
    });
    expect(mockMeta.cutLineRowForEvent).toHaveBeenCalledWith(EVENT_ID, 8);
  });

  it("names a Legend for its champion in the field's legend picker", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.fieldSummaryForEvent.mockResolvedValue({
      ...NO_FIELD,
      hasLegends: true,
      legends: [
        { cardId: CHAMPION_ID, name: "Swift Scout", types: ["legend"], tags: ["Teemo"], count: 2 },
        {
          cardId: LEGEND_ID,
          name: "Emperor of the Sands",
          types: ["legend"],
          tags: ["Azir"],
          count: 12,
        },
      ],
    });

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(json.field.legends).toEqual([
      { cardId: LEGEND_ID, name: "Azir, Emperor of the Sands", count: 12 },
      { cardId: CHAMPION_ID, name: "Teemo, Swift Scout", count: 2 },
    ]);
  });

  it("leaves the cut line out of an event that ran no cut", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow()]);

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(json.field.cutLine).toBeNull();
    expect(mockMeta.cutLineRowForEvent).not.toHaveBeenCalled();
  });

  it("draws each row's run from the matches its own players played", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(standingsPage([playerRow()]));
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);
    mockMeta.matchesForPlayers.mockResolvedValue([
      matchRow({ roundNumber: 1 }),
      matchRow({ id: "m-2", phaseOrder: 1, roundNumber: 1, winnerId: null, isDraw: true }),
    ]);

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(json.standings.players[0].rounds).toEqual([
      { phaseOrder: 0, roundNumber: 1, isCut: false, outcome: "win" },
      { phaseOrder: 1, roundNumber: 1, isCut: true, outcome: "draw" },
    ]);
    expect(mockMeta.matchesForPlayers).toHaveBeenCalledWith(EVENT_ID, [
      "p0000000-0001-4000-a000-000000000001",
    ]);
  });

  it("serves the cut's matches and nothing of the Swiss rounds", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);
    mockMeta.matchesInPhases.mockResolvedValue([matchRow({ phaseOrder: 1 })]);

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(mockMeta.matchesInPhases).toHaveBeenCalledWith(EVENT_ID, [1]);
    expect(json.cutMatches).toHaveLength(1);
    expect(json.cutMatches[0]).toMatchObject({ phaseOrder: 1, roundNumber: 1 });
  });

  it("names the best finish each legend took, whatever page it sits on", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.bestPerLegendForEvent.mockResolvedValue([
      playerRow({
        id: "p0000000-0001-4000-a000-000000000099",
        rank: 412,
        playerName: "Jinx",
        legendCardId: LEGEND_ID,
        legendName: "Azir",
        legendSlug: "azir",
      }),
    ]);

    const json = await readJson(await app.request("/api/v1/meta/events/summoner-skirmish-2026"));

    expect(json.bestPerLegend).toHaveLength(1);
    expect(json.bestPerLegend[0]).toMatchObject({ playerName: "Jinx", rank: 412 });
  });

  it("says whether a rank is an exact standing or a cut bucket", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(
      standingsPage([
        playerRow({ rank: 1, rankIsTier: false }),
        playerRow({
          id: "p0000000-0001-4000-a000-000000000002",
          rank: 8,
          rankIsTier: true,
          playerName: "Ekko",
        }),
      ]),
    );

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(json.standings.players.map((p: { rankIsTier: boolean }) => p.rankIsTier)).toEqual([
      false,
      true,
    ]);
  });

  it("serves the phases those rounds belong to, so a cut is not guessed from their shape", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(json.phases).toEqual([
      {
        phaseOrder: 0,
        name: "Phase 1",
        roundType: "SWISS",
        roundCount: 8,
        rankRequired: null,
        maxGameWins: 2,
      },
      {
        phaseOrder: 1,
        name: "Phase 3",
        roundType: "RANKED_SINGLE_ELIMINATION",
        roundCount: 3,
        rankRequired: 8,
        maxGameWins: 2,
      },
    ]);
  });

  it("resolves every legend and champion image in one batch", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(
      standingsPage([
        playerRow({
          legendCardId: LEGEND_ID,
          legendName: "Azir",
          legendSlug: "azir",
          legendDomains: ["order", "calm"],
          championCardId: CHAMPION_ID,
          championName: "Jinx",
          championSlug: "jinx",
          championDomains: ["chaos"],
        }),
        playerRow({
          id: "p0000000-0001-4000-a000-000000000002",
          rank: 2,
          playerName: "Ekko",
          legendCardId: LEGEND_ID,
          legendName: "Azir",
          legendSlug: "azir",
        }),
      ]),
    );
    mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([
      { imageId: "img-legend" },
      { imageId: null },
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(mockCanonicalPrintings.resolvePrintingMetaForRows).toHaveBeenCalledTimes(1);
    expect(mockCanonicalPrintings.resolvePrintingMetaForRows).toHaveBeenCalledWith([
      { cardId: LEGEND_ID, preferredPrintingId: null },
      { cardId: CHAMPION_ID, preferredPrintingId: null },
    ]);
    expect(json.standings.players[0].legend).toEqual({
      cardId: LEGEND_ID,
      name: "Azir",
      slug: "azir",
      imageId: "img-legend",
      domains: ["order", "calm"],
      archiveSlug: "azir",
    });
    expect(json.standings.players[0].champion).toEqual({
      cardId: CHAMPION_ID,
      name: "Jinx",
      slug: "jinx",
      imageId: null,
      domains: ["chaos"],
      archiveSlug: null,
    });
    expect(json.standings.players[1].champion).toBeNull();
  });

  it("names a Legend for its champion, so a standings line reads the way players say it", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(
      standingsPage([
        playerRow({
          legendCardId: LEGEND_ID,
          legendName: "Emperor of the Sands",
          legendSlug: "emperor-of-the-sands",
          legendTypes: ["legend"],
          legendTags: ["Azir"],
        }),
      ]),
    );
    mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([
      { imageId: "img-legend" },
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026");

    const json = await readJson(res);
    expect(json.standings.players[0].legend).toEqual({
      cardId: LEGEND_ID,
      name: "Azir, Emperor of the Sands",
      slug: "emperor-of-the-sands",
      imageId: "img-legend",
      domains: [],
      archiveSlug: "azir-emperor-of-the-sands",
    });
  });

  it("404s an unknown slug without reading citations or contributors", async () => {
    mockMeta.eventBySlug.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/meta/events/no-such-event");

    expect(res.status).toBe(404);
    expect(mockMeta.standingsPage).not.toHaveBeenCalled();
    expect(mockMeta.sourcesForEvent).not.toHaveBeenCalled();
    expect(mockMeta.contributorsForEvent).not.toHaveBeenCalled();
  });
});

describe("GET /meta/events/{slug}/standings", () => {
  it("pages the field and reports how many the filter matches", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(standingsPage([playerRow()], 2054));

    const res = await app.request(
      "/api/v1/meta/events/summoner-skirmish-2026/standings?limit=200&offset=200",
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.players).toHaveLength(1);
    expect(json.total).toBe(2054);
    expect(mockMeta.standingsPage).toHaveBeenCalledWith(
      EVENT_ID,
      { q: undefined, withList: false, legend: undefined },
      { limit: 200, offset: 200 },
    );
  });

  it("forwards the page's own narrowing", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());

    await app.request(
      `/api/v1/meta/events/summoner-skirmish-2026/standings?q=ren&list=with&legend=${LEGEND_ID}`,
    );

    expect(mockMeta.standingsPage).toHaveBeenCalledWith(
      EVENT_ID,
      { q: "ren", withList: true, legend: LEGEND_ID },
      { limit: 200, offset: 0 },
    );
  });

  it("draws each row's run and 404s an unknown event", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(standingsPage([playerRow()]));
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow()]);
    mockMeta.matchesForPlayers.mockResolvedValue([matchRow()]);

    const json = await readJson(
      await app.request("/api/v1/meta/events/summoner-skirmish-2026/standings"),
    );
    expect(json.players[0].rounds).toEqual([
      { phaseOrder: 0, roundNumber: 1, isCut: false, outcome: "win" },
    ]);

    mockMeta.eventBySlug.mockResolvedValue(undefined);
    const missing = await app.request("/api/v1/meta/events/nope/standings");
    expect(missing.status).toBe(404);
  });

  it("serves the whole field to a reader who asks for it, and no more", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());

    const all = await app.request(
      "/api/v1/meta/events/summoner-skirmish-2026/standings?limit=5000",
    );
    const past = await app.request(
      "/api/v1/meta/events/summoner-skirmish-2026/standings?limit=5001",
    );

    expect(all.status).toBe(200);
    expect(past.status).toBe(400);
  });
});

describe("GET /meta/events/{slug}/players/{key}/run", () => {
  const OPPONENT_ID = "p0000000-0001-4000-a000-000000000002";

  it("serves one player's rounds with the opponents they were played against", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsRowByKey.mockResolvedValue(playerRow());
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);
    mockMeta.matchesForPlayers.mockResolvedValue([
      matchRow({ roundNumber: 1 }),
      matchRow({ id: "m-2", phaseOrder: 1, roundNumber: 2, winnerId: OPPONENT_ID }),
    ]);
    mockMeta.standingsRowsByIds.mockResolvedValue([
      playerRow({ id: OPPONENT_ID, rank: 2, playerName: "Ekko" }),
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026/players/u347713/run");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.rounds).toEqual([
      {
        phaseOrder: 0,
        roundNumber: 1,
        isCut: false,
        tableNumber: 4,
        outcome: "win",
        gamesWon: 2,
        gamesLost: 1,
        opponentId: OPPONENT_ID,
      },
      {
        phaseOrder: 1,
        roundNumber: 2,
        isCut: true,
        tableNumber: 4,
        outcome: "loss",
        gamesWon: 2,
        gamesLost: 1,
        opponentId: OPPONENT_ID,
      },
    ]);
    expect(json.opponents.map((row: { playerName: string }) => row.playerName)).toEqual(["Ekko"]);
    expect(json.player.rounds).toHaveLength(2);
    expect(json.lastCutRound).toBeNull();
    expect(mockMeta.standingsRowByKey).toHaveBeenCalledWith(EVENT_ID, "u347713");
  });

  it("names the final only when the cut's last round held one match", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsRowByKey.mockResolvedValue(playerRow());
    mockMeta.phasesForEvent.mockResolvedValue([phaseRow(), cutPhaseRow()]);
    mockMeta.matchesInPhases.mockResolvedValue([
      matchRow({ phaseOrder: 1, roundNumber: 1 }),
      matchRow({ id: "m-2", phaseOrder: 1, roundNumber: 2 }),
    ]);

    const json = await readJson(
      await app.request("/api/v1/meta/events/summoner-skirmish-2026/players/u347713/run"),
    );
    expect(json).toMatchObject({ lastCutRound: 2, finalRoundNumber: 2 });

    mockMeta.matchesInPhases.mockResolvedValue([
      matchRow({ phaseOrder: 1, roundNumber: 2 }),
      matchRow({ id: "m-3", phaseOrder: 1, roundNumber: 2, tableNumber: 2 }),
    ]);

    const withPlayoff = await readJson(
      await app.request("/api/v1/meta/events/summoner-skirmish-2026/players/u347713/run"),
    );
    expect(withPlayoff).toMatchObject({ lastCutRound: 2, finalRoundNumber: null });
  });

  it("reads the opponents once, however often they were played", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsRowByKey.mockResolvedValue(playerRow());
    mockMeta.matchesForPlayers.mockResolvedValue([
      matchRow({ roundNumber: 1 }),
      matchRow({ id: "m-2", roundNumber: 2 }),
    ]);

    await app.request("/api/v1/meta/events/summoner-skirmish-2026/players/u347713/run");

    expect(mockMeta.standingsRowsByIds).toHaveBeenCalledWith([OPPONENT_ID]);
  });

  it("says nothing about a player no standings row at this event answers to", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsRowByKey.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026/players/nobody/run");

    expect(res.status).toBe(404);
    expect(mockMeta.matchesForPlayers).not.toHaveBeenCalled();
  });

  it("404s an unknown event without reading a standings row", async () => {
    mockMeta.eventBySlug.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/meta/events/no-such-event/players/u347713/run");

    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toBe("Event not found");
    expect(mockMeta.standingsRowByKey).not.toHaveBeenCalled();
  });
});

describe("GET /meta/events/{slug}/pending-submissions", () => {
  function pendingRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "s0000000-0001-4000-a000-000000000001",
      userId: "user-1",
      kind: "new_list",
      metaEventPlayerId: "p0000000-0001-4000-a000-000000000001",
      playerName: "Renata",
      rank: 3,
      rankIsTier: false,
      ...overrides,
    };
  }

  it("tells a signed-in viewer which submissions are theirs, without any user id", async () => {
    viewer = { id: "user-1" };
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMetaSubmissions.pendingForEvent.mockResolvedValue([
      pendingRow(),
      pendingRow({ id: "s2", userId: "user-2", metaEventPlayerId: null }),
    ]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026/pending-submissions");
    viewer = null;

    expect(res.status).toBe(200);
    const json = await readJson<{ items: Record<string, unknown>[] }>(res);
    expect(mockMetaSubmissions.pendingForEvent).toHaveBeenCalledWith(EVENT_ID);
    expect(json.items.map((item) => item.mine)).toEqual([true, false]);
    expect(json.items[1]).toEqual({
      id: "s2",
      kind: "new_list",
      metaEventPlayerId: null,
      playerName: "Renata",
      rank: 3,
      rankIsTier: false,
      mine: false,
    });
  });

  it("marks nothing as the viewer's for an anonymous visitor", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMetaSubmissions.pendingForEvent.mockResolvedValue([pendingRow()]);

    const res = await app.request("/api/v1/meta/events/summoner-skirmish-2026/pending-submissions");

    const json = await readJson<{ items: { mine: boolean }[] }>(res);
    expect(json.items).toEqual([expect.objectContaining({ mine: false })]);
  });

  it("404s an unknown slug", async () => {
    mockMeta.eventBySlug.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/meta/events/no-such-event/pending-submissions");

    expect(res.status).toBe(404);
  });
});

function indexPage(rows: Record<string, unknown>[] = [], total = rows.length) {
  return { rows, total };
}

describe("GET /meta/events", () => {
  it("asks for the first page of the whole archive when the request narrows nothing", async () => {
    const res = await app.request("/api/v1/meta/events");

    expect(res.status).toBe(200);
    expect(mockMeta.eventIndex).toHaveBeenCalledWith({}, {}, { limit: 50, offset: 0 });
  });

  it("forwards the window, the page's own filters, the sort and the page", async () => {
    await app.request(
      "/api/v1/meta/events?from=2026-01-01&to=2026-06-30&q=skirmish&holds=decks" +
        "&playersMin=8&playersMax=64&by=players&dir=asc&limit=10&offset=20",
    );

    expect(mockMeta.eventIndex).toHaveBeenCalledWith(
      {
        from: "2026-01-01",
        to: "2026-06-30",
        q: "skirmish",
        holds: "decks",
        playersMin: 8,
        playersMax: 64,
      },
      { by: "players", dir: "asc" },
      { limit: 10, offset: 20 },
    );
  });

  it("rejects a bound that is not a calendar day", async () => {
    const res = await app.request("/api/v1/meta/events?to=2026-06");

    expect(res.status).toBe(400);
    expect(mockMeta.eventIndex).not.toHaveBeenCalled();
  });

  it("serves the largest page the index's own picker offers", async () => {
    const res = await app.request("/api/v1/meta/events?limit=500");

    expect(res.status).toBe(200);
    expect(mockMeta.eventIndex).toHaveBeenCalledWith({}, {}, { limit: 500, offset: 0 });
  });

  it("refuses to serve a page larger than the cap", async () => {
    const res = await app.request("/api/v1/meta/events?limit=5000");

    expect(res.status).toBe(400);
    expect(mockMeta.eventIndex).not.toHaveBeenCalled();
  });

  it("reports how many events the filter matches beyond the page", async () => {
    mockMeta.eventIndex.mockResolvedValue(indexPage([eventRow()], 812));

    const json = await readJson(await app.request("/api/v1/meta/events?limit=1"));

    expect(json.events).toHaveLength(1);
    expect(json.total).toBe(812);
  });

  it("leaves the long-form fields off the list rows", async () => {
    mockMeta.eventIndex.mockResolvedValue(
      indexPage([eventRow({ playerRowCount: 64, deckCount: 8 })]),
    );

    const res = await app.request("/api/v1/meta/events");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.events[0].slug).toBe("summoner-skirmish-2026");
    expect(json.events[0].playerRowCount).toBe(64);
    expect(json.events[0].deckCount).toBe(8);
    expect(json.events[0].notes).toBeUndefined();
    expect(json.events[0].sources).toBeUndefined();
  });

  it("names each event's podium inline, with the legend's artwork", async () => {
    mockMeta.eventIndex.mockResolvedValue(
      indexPage([eventRow({ playerRowCount: 64, deckCount: 8 })]),
    );
    mockMeta.topFinishesForEvents.mockResolvedValue([
      {
        ...playerRow({ legendCardId: LEGEND_ID, legendName: "Jinx", legendSlug: "jinx" }),
        metaEventId: EVENT_ID,
      },
    ]);
    mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([{ imageId: "img-jinx" }]);

    const res = await app.request("/api/v1/meta/events");

    const json = await readJson(res);
    expect(json.events[0].topFinishes).toHaveLength(1);
    expect(json.events[0].topFinishes[0]).toMatchObject({
      rank: 1,
      rankIsTier: false,
      playerName: "Renata",
      wins: 5,
      losses: 1,
      draws: 0,
      legend: { slug: "jinx", imageId: "img-jinx" },
    });
  });

  it("names both players when the source published two first places", async () => {
    mockMeta.eventIndex.mockResolvedValue(indexPage([eventRow()]));
    mockMeta.topFinishesForEvents.mockResolvedValue([
      { ...playerRow({ playerName: "Ashe" }), metaEventId: EVENT_ID },
      {
        ...playerRow({ id: "p0000000-0001-4000-a000-000000000002", playerName: "Zed" }),
        metaEventId: EVENT_ID,
      },
    ]);

    const res = await app.request("/api/v1/meta/events");

    const json = await readJson(res);
    expect(
      json.events[0].topFinishes.map((entry: { playerName: string }) => entry.playerName),
    ).toEqual(["Ashe", "Zed"]);
  });

  it("names no winner for an event whose standings have not arrived", async () => {
    mockMeta.eventIndex.mockResolvedValue(indexPage([eventRow()]));

    const res = await app.request("/api/v1/meta/events");

    const json = await readJson(res);
    expect(json.events[0].topFinishes).toEqual([]);
  });
});

describe("GET /meta/events/facets", () => {
  beforeEach(() => {
    mockMeta.eventFacetCounts.mockResolvedValue({ formats: [], tiers: [], countries: [] });
    mockMeta.eventHoldingsCounts.mockResolvedValue({
      all: 0,
      decks: 0,
      standings: 0,
      upcoming: 0,
      resultless: 0,
    });
    mockMeta.eventTotals.mockResolvedValue({ events: 0, playerRows: 0, decks: 0 });
  });

  it("counts the facets, the holdings and the rows under one filter", async () => {
    mockMeta.eventFacetCounts.mockResolvedValue({
      formats: [{ value: "constructed", count: 3 }],
      tiers: [{ value: "premier", count: 1 }],
      countries: [{ value: "DE", count: 2 }],
    });
    mockMeta.eventHoldingsCounts.mockResolvedValue({
      all: 3,
      decks: 1,
      standings: 2,
      upcoming: 1,
      resultless: 0,
    });
    mockMeta.eventTotals.mockResolvedValue({ events: 3, playerRows: 96, decks: 8 });

    const res = await app.request("/api/v1/meta/events/facets?q=skirmish&tiers[0]=premier");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.formats).toEqual([{ value: "constructed", count: 3 }]);
    expect(json.holdings.decks).toBe(1);
    expect(json.totals).toEqual({ events: 3, playerRows: 96, decks: 8 });
    for (const spy of [
      mockMeta.eventFacetCounts,
      mockMeta.eventHoldingsCounts,
      mockMeta.eventTotals,
    ]) {
      expect(spy).toHaveBeenCalledWith({ q: "skirmish", tiers: ["premier"] });
    }
  });

  it("rejects a filter the index would not accept either", async () => {
    const res = await app.request("/api/v1/meta/events/facets?holds=maybe");

    expect(res.status).toBe(400);
    expect(mockMeta.eventFacetCounts).not.toHaveBeenCalled();
  });
});

describe("GET /meta/activity", () => {
  it("prints each burst with its event and an ISO timestamp", async () => {
    mockMeta.recentActivity.mockResolvedValue([
      {
        kind: "decks-added",
        occurredAt: new Date("2026-08-25T12:00:00.000Z"),
        count: 8,
        eventSlug: "summoner-skirmish-2026",
        eventName: "Summoner Skirmish",
      },
      {
        kind: "event-added",
        occurredAt: new Date("2026-08-24T09:00:00.000Z"),
        count: null,
        eventSlug: "nexus-night",
        eventName: "Nexus Night",
      },
    ]);

    const res = await app.request("/api/v1/meta/activity");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.items).toEqual([
      {
        kind: "decks-added",
        occurredAt: "2026-08-25T12:00:00.000Z",
        count: 8,
        event: { slug: "summoner-skirmish-2026", name: "Summoner Skirmish" },
      },
      {
        kind: "event-added",
        occurredAt: "2026-08-24T09:00:00.000Z",
        count: null,
        event: { slug: "nexus-night", name: "Nexus Night" },
      },
    ]);
  });

  it("reports an empty archive as no items", async () => {
    const res = await app.request("/api/v1/meta/activity");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ items: [] });
  });
});

function legendRow(overrides: Record<string, unknown> = {}) {
  return {
    cardId: LEGEND_ID,
    name: "Heart of the Tempest",
    slug: "heart-of-the-tempest",
    types: ["legend"],
    tags: ["Kennen"],
    domains: ["chaos", "order"],
    ...overrides,
  };
}

function finishRow(overrides: Record<string, unknown> = {}) {
  return {
    playerId: "p0000000-0001-4000-a000-000000000001",
    rank: 1,
    rankIsTier: false,
    playerName: "Renata",
    sourceIdentity: "u347713",
    wins: 12,
    losses: 1,
    draws: 0,
    shareToken: null,
    listStatus: "none",
    eventSlug: "summoner-skirmish-2026",
    eventName: "Summoner Skirmish",
    eventDate: "2026-08-01",
    eventFormat: "constructed",
    eventTier: "local",
    eventCountry: "DE",
    eventPlayerCount: 64,
    ...overrides,
  };
}

function legendIndexRow(overrides: Record<string, unknown> = {}) {
  return {
    ...legendRow(),
    bestRank: 4,
    bestRankIsTier: false,
    bestEventId: EVENT_ID,
    finishes: 2,
    decklists: 1,
    eventWins: 0,
    ...overrides,
  };
}

describe("GET /meta/legends", () => {
  it("keys each legend on its champion and its card slug, ordered by the name a reader sees", async () => {
    mockMeta.scopedLegendRecords.mockResolvedValue([
      legendIndexRow(),
      legendIndexRow({
        cardId: "f0000000-0001-4000-a000-000000000009",
        name: "Emperor of the Sands",
        slug: "emperor-of-the-sands",
        tags: ["Azir"],
      }),
    ]);
    mockMeta.eventRowsByIds.mockResolvedValue([eventRow()]);

    const res = await app.request("/api/v1/meta/legends");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.legends.map((entry: { slug: string }) => entry.slug)).toEqual([
      "azir-emperor-of-the-sands",
      "kennen-heart-of-the-tempest",
    ]);
    expect(json.legends[1].legend).toMatchObject({
      name: "Kennen, Heart of the Tempest",
      slug: "heart-of-the-tempest",
      domains: ["chaos", "order"],
    });
  });

  it("carries each legend's scoped record and the event its best finish came at", async () => {
    mockMeta.scopedLegendRecords.mockResolvedValue([
      legendIndexRow({ finishes: 7, decklists: 3, eventWins: 1, bestRank: 1 }),
    ]);
    mockMeta.eventRowsByIds.mockResolvedValue([eventRow()]);
    mockMeta.scopedLegendCount.mockResolvedValue(12);
    mockMeta.scopedLegendCountries.mockResolvedValue(["DE", "FR"]);

    const json = await readJson(await app.request("/api/v1/meta/legends?tiers[0]=premier"));

    expect(json.legends[0]).toMatchObject({
      finishes: 7,
      decklists: 3,
      eventWins: 1,
      bestFinish: {
        rank: 1,
        rankIsTier: false,
        event: { slug: "summoner-skirmish-2026", playerCount: 64 },
      },
    });
    expect(json.total).toBe(12);
    expect(json.countries).toEqual(["DE", "FR"]);
    expect(mockMeta.scopedLegendRecords).toHaveBeenCalledWith({ tiers: ["premier"] });
  });

  it("counts the legends the scope matched, and the archive's own beside them", async () => {
    mockMeta.scopedLegendRecords.mockResolvedValue([legendIndexRow()]);
    mockMeta.eventRowsByIds.mockResolvedValue([eventRow()]);
    mockMeta.scopedLegendCount.mockImplementation((scope: Record<string, unknown>) =>
      Promise.resolve(Object.keys(scope).length === 0 ? 217 : 1),
    );

    const json = await readJson(await app.request("/api/v1/meta/legends?tiers[0]=premier"));

    expect(json).toMatchObject({ total: 1, archiveTotal: 217 });
    expect(mockMeta.scopedLegendCount).toHaveBeenCalledWith({ tiers: ["premier"] });
    expect(mockMeta.scopedLegendCount).toHaveBeenCalledWith({});
  });

  it("reports a total of zero for a scope no legend matched, the archive's size aside", async () => {
    mockMeta.scopedLegendRecords.mockResolvedValue([]);
    mockMeta.scopedLegendCount.mockImplementation((scope: Record<string, unknown>) =>
      Promise.resolve(Object.keys(scope).length === 0 ? 217 : 0),
    );

    const json = await readJson(await app.request("/api/v1/meta/legends?countries[0]=FR"));

    expect(json.legends).toEqual([]);
    expect(json).toMatchObject({ total: 0, archiveTotal: 217 });
  });

  it("drops a legend whose best event went missing between the two reads", async () => {
    mockMeta.scopedLegendRecords.mockResolvedValue([legendIndexRow()]);
    mockMeta.eventRowsByIds.mockResolvedValue([]);

    const json = await readJson(await app.request("/api/v1/meta/legends"));

    expect(json.legends).toEqual([]);
  });

  it("returns nothing for an archive with no standings yet", async () => {
    const json = await readJson(await app.request("/api/v1/meta/legends"));

    expect(json.legends).toEqual([]);
  });
});

describe("GET /meta/legends/{slug}", () => {
  it("returns one page of the record, the best placings and the scoped counts", async () => {
    mockMeta.archiveLegends.mockResolvedValue([legendRow()]);
    mockMeta.finishesForLegend.mockResolvedValue({
      rows: [
        finishRow({ shareToken: "tok-1", listStatus: "full" }),
        finishRow({
          playerId: "p0000000-0001-4000-a000-000000000002",
          rank: 4,
          playerName: "Ekko",
          eventTier: "premier",
        }),
      ],
      total: 31,
    });
    mockMeta.bestFinishesForLegend.mockResolvedValue([finishRow({ shareToken: "tok-1" })]);
    mockMeta.legendRecordCounts.mockResolvedValue({ wins: 3, finishes: 31, decklists: 9 });

    const res = await app.request("/api/v1/meta/legends/kennen-heart-of-the-tempest");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(mockMeta.finishesForLegend).toHaveBeenCalledWith(
      LEGEND_ID,
      { slug: "kennen-heart-of-the-tempest" },
      { limit: 25, offset: 0 },
    );
    expect(mockMeta.bestFinishesForLegend).toHaveBeenCalledWith(
      LEGEND_ID,
      { slug: "kennen-heart-of-the-tempest" },
      5,
    );
    expect(json.slug).toBe("kennen-heart-of-the-tempest");
    expect(json.legend.name).toBe("Kennen, Heart of the Tempest");
    expect(json.counts).toEqual({ wins: 3, finishes: 31, decklists: 9 });
    expect(json.best).toHaveLength(1);
    expect(json.total).toBe(31);
    expect(json.page).toBe(1);
    expect(json.finishes).toHaveLength(2);
    expect(json.finishes[0]).toMatchObject({ rank: 1, shareToken: "tok-1", listStatus: "full" });
    expect(json.finishes[1].event).toMatchObject({
      slug: "summoner-skirmish-2026",
      tier: "premier",
      country: "DE",
      playerCount: 64,
    });
  });

  it("forwards the scope facets and the page the request asked for", async () => {
    mockMeta.archiveLegends.mockResolvedValue([legendRow()]);

    const res = await app.request(
      "/api/v1/meta/legends/kennen-heart-of-the-tempest" +
        "?from=2026-01-01&tiers[0]=premier&tiers[1]=competitive&countriesEx[0]=DE&page=3",
    );

    expect(res.status).toBe(200);
    const scope = {
      slug: "kennen-heart-of-the-tempest",
      from: "2026-01-01",
      tiers: ["premier", "competitive"],
      countriesEx: ["DE"],
      page: 3,
    };
    expect(mockMeta.finishesForLegend).toHaveBeenCalledWith(LEGEND_ID, scope, {
      limit: 25,
      offset: 50,
    });
    expect(mockMeta.legendRecordCounts).toHaveBeenCalledWith(LEGEND_ID, scope);
    const json = await readJson(res);
    expect(json.page).toBe(3);
  });

  it("rejects a page that is not a positive whole number", async () => {
    mockMeta.archiveLegends.mockResolvedValue([legendRow()]);

    const res = await app.request("/api/v1/meta/legends/kennen-heart-of-the-tempest?page=0");

    expect(res.status).toBe(400);
    expect(mockMeta.finishesForLegend).not.toHaveBeenCalled();
  });

  it("separates two legends of one champion by their card slugs", async () => {
    mockMeta.archiveLegends.mockResolvedValue([
      legendRow({ name: "Wuju Master", slug: "wuju-master", tags: ["Master Yi"] }),
      legendRow({
        cardId: "f0000000-0001-4000-a000-000000000003",
        name: "Wuju Bladesman, Starter",
        slug: "wuju-bladesman-starter",
        tags: ["Master Yi"],
      }),
    ]);

    const res = await app.request("/api/v1/meta/legends/master-yi-wuju-bladesman-starter");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(mockMeta.finishesForLegend).toHaveBeenCalledWith(
      "f0000000-0001-4000-a000-000000000003",
      expect.anything(),
      expect.anything(),
    );
    expect(json.legend.name).toBe("Master Yi, Wuju Bladesman");
  });

  it("404s a slug no archived legend answers to", async () => {
    mockMeta.archiveLegends.mockResolvedValue([legendRow()]);

    const res = await app.request("/api/v1/meta/legends/teemo-swift-scout");

    expect(res.status).toBe(404);
    expect(mockMeta.finishesForLegend).not.toHaveBeenCalled();
  });

  it("resolves the key a standings row hands its legend link", async () => {
    mockMeta.eventBySlug.mockResolvedValue(eventRow());
    mockMeta.standingsPage.mockResolvedValue(
      standingsPage([
        playerRow({
          legendCardId: LEGEND_ID,
          legendName: "Heart of the Tempest",
          legendSlug: "heart-of-the-tempest",
          legendTypes: ["legend"],
          legendTags: ["Kennen"],
        }),
      ]),
    );
    mockMeta.archiveLegends.mockResolvedValue([legendRow()]);

    const standings = await readJson(
      await app.request("/api/v1/meta/events/summoner-skirmish-2026"),
    );
    const linked = standings.standings.players[0].legend.archiveSlug as string;

    const res = await app.request(`/api/v1/meta/legends/${linked}`);
    expect(res.status).toBe(200);
    const legend = await readJson(res);
    expect(legend.slug).toBe(linked);
  });

  it("returns a legend with no finishes rather than 404ing it", async () => {
    mockMeta.archiveLegends.mockResolvedValue([legendRow({ deckCount: 0 })]);

    const res = await app.request("/api/v1/meta/legends/kennen-heart-of-the-tempest");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.finishes).toEqual([]);
  });
});

function playerFinishRow(overrides: Record<string, unknown> = {}) {
  return {
    playerId: "p0000000-0001-4000-a000-000000000001",
    playerName: "乌冬",
    rank: 1,
    rankIsTier: false,
    wins: 12,
    losses: 1,
    draws: 0,
    shareToken: null,
    listStatus: "none",
    legendCardId: LEGEND_ID,
    legendName: "Heart of the Tempest",
    legendSlug: "heart-of-the-tempest",
    legendTypes: ["legend"],
    legendTags: ["Kennen"],
    legendDomains: ["chaos", "order"],
    eventSlug: "summoner-skirmish-2026",
    eventName: "Summoner Skirmish",
    eventDate: "2026-08-01",
    eventFormat: "constructed",
    eventTier: "local",
    eventCountry: "DE",
    eventPlayerCount: 64,
    ...overrides,
  };
}

describe("GET /meta/players/{key}", () => {
  it("returns every archived finish under the key, titled by the newest row's name", async () => {
    mockMeta.finishesForPlayer.mockResolvedValue([
      playerFinishRow({ playerName: "乌冬 the Second" }),
      playerFinishRow({
        playerId: "p0000000-0001-4000-a000-000000000002",
        rank: 4,
        eventSlug: "regional-lyon",
        eventTier: "premier",
      }),
    ]);

    const res = await app.request("/api/v1/meta/players/pn%E4%B9%8C%E5%86%AC");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(mockMeta.finishesForPlayer).toHaveBeenCalledWith("pn乌冬");
    expect(json.key).toBe("pn乌冬");
    expect(json.name).toBe("乌冬 the Second");
    expect(json.finishes).toHaveLength(2);
    expect(json.finishes[1].event).toMatchObject({ slug: "regional-lyon", tier: "premier" });
  });

  it("names each finish's legend the way players say it, with its archive key", async () => {
    mockMeta.finishesForPlayer.mockResolvedValue([playerFinishRow()]);
    mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([
      { imageId: "img-legend" },
    ]);

    const res = await app.request("/api/v1/meta/players/u347713");

    const json = await readJson(res);
    expect(json.finishes[0].legend).toEqual({
      cardId: LEGEND_ID,
      name: "Kennen, Heart of the Tempest",
      slug: "heart-of-the-tempest",
      imageId: "img-legend",
      domains: ["chaos", "order"],
      archiveSlug: "kennen-heart-of-the-tempest",
    });
  });

  it("resolves one printing per legend however many finishes name it", async () => {
    mockMeta.finishesForPlayer.mockResolvedValue([
      playerFinishRow(),
      playerFinishRow({ playerId: "p0000000-0001-4000-a000-000000000002" }),
      playerFinishRow({ playerId: "p0000000-0001-4000-a000-000000000003", legendCardId: null }),
    ]);
    mockCanonicalPrintings.resolvePrintingMetaForRows.mockResolvedValue([
      { imageId: "img-legend" },
    ]);

    await app.request("/api/v1/meta/players/u347713");

    expect(mockCanonicalPrintings.resolvePrintingMetaForRows).toHaveBeenCalledWith([
      { cardId: LEGEND_ID, preferredPrintingId: null },
    ]);
  });

  it("404s a key the archive holds no standings row for", async () => {
    const res = await app.request("/api/v1/meta/players/u999999");

    expect(res.status).toBe(404);
  });
});

function deckSummaryRow(overrides: Record<string, unknown> = {}) {
  return {
    playerId: "p0000000-0001-4000-a000-000000000001",
    deckId: "d0000000-0001-4000-a000-000000000001",
    shareToken: "tok-1",
    listStatus: "full",
    deckName: "Kennen Tempo",
    deckFormat: "constructed",
    legendCardId: LEGEND_ID,
    legendName: "Heart of the Tempest",
    legendSlug: "heart-of-the-tempest",
    legendTypes: ["legend"],
    legendTags: ["Kennen"],
    championCardId: CHAMPION_ID,
    championName: "Kennen",
    playerName: "Renata",
    sourceIdentity: "u347713",
    rank: 1,
    rankIsTier: false,
    wins: 6,
    losses: 1,
    draws: 0,
    eventSlug: "summoner-skirmish-2026",
    eventName: "Summoner Skirmish",
    eventDate: "2026-08-01",
    eventFormat: "constructed",
    eventTier: "local",
    eventCountry: "DE",
    ...overrides,
  };
}

describe("GET /meta/decks", () => {
  it("asks for the whole archive when the request names no window", async () => {
    const res = await app.request("/api/v1/meta/decks");

    expect(res.status).toBe(200);
    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({});
  });

  it("forwards an inclusive window to the repo", async () => {
    const res = await app.request("/api/v1/meta/decks?from=2026-01-01&to=2026-06-30");

    expect(res.status).toBe(200);
    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-06-30",
    });
  });

  it("forwards an open-ended window", async () => {
    await app.request("/api/v1/meta/decks?from=2026-07-01");

    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({ from: "2026-07-01" });
  });

  it("forwards the legend, the player and the cap", async () => {
    await app.request(`/api/v1/meta/decks?legend=${LEGEND_ID}&player=renata&limit=12`);

    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({
      legend: LEGEND_ID,
      player: "renata",
      limit: 12,
    });
  });

  it("forwards a tier include and a country exclude", async () => {
    await app.request("/api/v1/meta/decks?tiers[0]=premier&countriesEx[0]=DE&limit=8");

    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({
      tiers: ["premier"],
      countriesEx: ["DE"],
      limit: 8,
    });
  });

  it("reports the count before the cap alongside the rows", async () => {
    mockMeta.allDeckSummaries.mockResolvedValue({
      rows: [deckSummaryRow()],
      total: 40,
      eventCount: 3,
      archiveTotal: 6266,
    });

    const json = await readJson(await app.request("/api/v1/meta/decks?limit=1"));

    expect(json.decks).toHaveLength(1);
    expect(json.total).toBe(40);
  });

  it("counts the events the match spans and the archive's own size beside the match", async () => {
    mockMeta.allDeckSummaries.mockResolvedValue({
      rows: [deckSummaryRow()],
      total: 60,
      eventCount: 7,
      archiveTotal: 6266,
    });

    const json = await readJson(await app.request("/api/v1/meta/decks?tiers[0]=premier&limit=50"));

    expect(json).toMatchObject({ total: 60, eventCount: 7, archiveTotal: 6266 });
  });

  it("still reports the archive's size for a filter that matched no deck", async () => {
    mockMeta.allDeckSummaries.mockResolvedValue({
      rows: [],
      total: 0,
      eventCount: 0,
      archiveTotal: 6266,
    });

    const json = await readJson(await app.request("/api/v1/meta/decks?countries[0]=FR"));

    expect(json.decks).toEqual([]);
    expect(json).toMatchObject({ total: 0, eventCount: 0, archiveTotal: 6266 });
  });

  it("rejects a bound that is not a calendar day", async () => {
    const res = await app.request("/api/v1/meta/decks?from=last-week");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckSummaries).not.toHaveBeenCalled();
  });

  it("rejects a cap that is not a positive whole number", async () => {
    const res = await app.request("/api/v1/meta/decks?limit=0");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckSummaries).not.toHaveBeenCalled();
  });

  it("rejects a legend that is not a card id, which the database cannot compare", async () => {
    const res = await app.request("/api/v1/meta/decks?legends[0]=not-a-card");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckSummaries).not.toHaveBeenCalled();
  });

  it("rejects an offset past the bound rather than handing it to the database", async () => {
    const res = await app.request("/api/v1/meta/decks?offset=99999999999999999999");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckSummaries).not.toHaveBeenCalled();
  });

  it("forwards the browser's narrowing, its order and the page it asks for", async () => {
    await app.request(
      `/api/v1/meta/decks?events[0]=rift-open&legends[0]=${LEGEND_ID}&maxRank=8&curated=true&by=finish&dir=asc&limit=50&offset=100`,
    );

    expect(mockMeta.allDeckSummaries).toHaveBeenCalledWith({
      events: ["rift-open"],
      legends: [LEGEND_ID],
      maxRank: 8,
      curated: true,
      by: "finish",
      dir: "asc",
      limit: 50,
      offset: 100,
    });
  });

  it("rejects an order it cannot run in the database", async () => {
    const res = await app.request("/api/v1/meta/decks?by=value");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckSummaries).not.toHaveBeenCalled();
  });

  it("hands over the events the page's lists were played at", async () => {
    mockMeta.allDeckSummaries.mockResolvedValue({
      rows: [deckSummaryRow()],
      total: 1,
      eventCount: 1,
      archiveTotal: 1,
    });
    mockMeta.eventsBySlugs.mockResolvedValue([]);

    await app.request("/api/v1/meta/decks");

    expect(mockMeta.eventsBySlugs).toHaveBeenCalledWith(["summoner-skirmish-2026"]);
  });
});

describe("GET /meta/decks/facets", () => {
  it("counts each facet under the same narrowing, the page aside", async () => {
    mockMeta.deckFacetCounts.mockResolvedValue({
      events: [{ slug: "rift-open", name: "Rift Open", eventDate: "2026-08-01", count: 4 }],
      legends: [],
      finishes: [{ value: 8, count: 2 }],
      countries: ["DE"],
    });

    const res = await app.request("/api/v1/meta/decks/facets?tiers[0]=premier&curated=true");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.events).toEqual([{ value: "rift-open", label: "Rift Open", count: 4 }]);
    expect(json.finishes).toEqual([{ value: 8, count: 2 }]);
    expect(mockMeta.deckFacetCounts).toHaveBeenCalledWith({ tiers: ["premier"], curated: true });
  });

  it("labels a legend chip with the champion-led name, and orders the chips by it", async () => {
    mockMeta.deckFacetCounts.mockResolvedValue({
      events: [],
      legends: [
        { cardId: CHAMPION_ID, name: "Swift Scout", types: ["legend"], tags: ["Teemo"], count: 2 },
        {
          cardId: LEGEND_ID,
          name: "Emperor of the Sands",
          types: ["legend"],
          tags: ["Azir"],
          count: 9,
        },
      ],
      finishes: [],
      countries: [],
    });

    const json = await readJson(await app.request("/api/v1/meta/decks/facets"));

    expect(json.legends).toEqual([
      { value: LEGEND_ID, label: "Azir, Emperor of the Sands", count: 9 },
      { value: CHAMPION_ID, label: "Teemo, Swift Scout", count: 2 },
    ]);
  });

  it("offers the events newest first", async () => {
    mockMeta.deckFacetCounts.mockResolvedValue({
      events: [
        { slug: "rift-open", name: "Rift Open", eventDate: "2026-08-01", count: 4 },
        { slug: "skirmish", name: "Summoner Skirmish", eventDate: "2026-09-01", count: 1 },
      ],
      legends: [],
      finishes: [],
      countries: [],
    });

    const json = await readJson(await app.request("/api/v1/meta/decks/facets"));

    expect(json.events.map((event: { value: string }) => event.value)).toEqual([
      "skirmish",
      "rift-open",
    ]);
  });

  it("counts the whole narrowing, whatever page the caller is on", async () => {
    await app.request("/api/v1/meta/decks/facets?limit=10&offset=50");

    expect(mockMeta.deckFacetCounts).toHaveBeenCalledWith({});
  });
});

describe("GET /meta/deck-cards", () => {
  it("names one event's whole field when the request asks for an event", async () => {
    const res = await app.request("/api/v1/meta/deck-cards?event=summoner-skirmish-2026");

    expect(res.status).toBe(200);
    expect(mockMeta.allDeckCards).toHaveBeenCalledWith({ eventSlug: "summoner-skirmish-2026" });
  });

  it("forwards the browser's own narrowing and page, so it prices what the grid shows", async () => {
    await app.request(
      `/api/v1/meta/deck-cards?from=2026-01-01&legends[0]=${LEGEND_ID}&curated=true&by=finish&dir=asc&limit=50&offset=100`,
    );

    expect(mockMeta.allDeckCards).toHaveBeenCalledWith({
      from: "2026-01-01",
      legends: [LEGEND_ID],
      curated: true,
      by: "finish",
      dir: "asc",
      limit: 50,
      offset: 100,
      eventSlug: undefined,
    });
  });

  it("rejects a bound that is not a calendar day", async () => {
    const res = await app.request("/api/v1/meta/deck-cards?to=2026-06");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckCards).not.toHaveBeenCalled();
  });

  it("rejects a legend that is not a card id, which the database cannot compare", async () => {
    const res = await app.request("/api/v1/meta/deck-cards?legends[0]=not-a-card");

    expect(res.status).toBe(400);
    expect(mockMeta.allDeckCards).not.toHaveBeenCalled();
  });
});

describe("GET /meta/counts", () => {
  it("returns both scope counts and forwards the event-level filters", async () => {
    mockMeta.playerCountInScope.mockResolvedValue(240);
    mockMeta.deckCountInScope.mockResolvedValue(12);

    const res = await app.request("/api/v1/meta/counts?format=constructed");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toMatchObject({ totalPlayers: 240, decksWithMainDeck: 12 });
    expect(mockMeta.playerCountInScope).toHaveBeenCalledWith({ format: "constructed" });
    expect(mockMeta.deckCountInScope).toHaveBeenCalledWith({ format: "constructed" });
  });

  it("reports the archive's own event numbers, which the filters never narrow", async () => {
    mockMeta.playerCountInScope.mockResolvedValue(0);
    mockMeta.deckCountInScope.mockResolvedValue(0);
    mockMeta.eventTierCounts.mockResolvedValue({ premier: 4, competitive: 31, local: 912 });

    const json = await readJson(await app.request("/api/v1/meta/counts?format=constructed"));

    expect(json.eventsByTier).toEqual({ premier: 4, competitive: 31, local: 912 });
    expect(json.totalEvents).toBe(947);
    expect(mockMeta.eventTierCounts).toHaveBeenCalledWith();
  });
});
