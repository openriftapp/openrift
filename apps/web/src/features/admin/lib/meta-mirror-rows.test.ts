import type {
  MetaCatalogRow,
  PlayloltcgCatalogRow,
  PlayriftboundCatalogRow,
  TopdeckCatalogRow,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { describe, expect, it } from "vitest";

import {
  playloltcgMirrorRow,
  playriftboundMirrorRow,
  topdeckMirrorRow,
  uvsgamesMirrorRow,
} from "./meta-mirror-rows";

const NOW = new Date("2026-10-28T17:00:00.000Z");

function uvsgames(overrides: Partial<MetaCatalogRow> = {}): MetaCatalogRow {
  return {
    externalId: "923368",
    name: "LAI LA NIU LAI CMC TUESDAY NEXUS NIGHT 1v1",
    startAt: "2026-09-08T12:30:00.000Z",
    endAtEstimate: null,
    displayStatus: "complete",
    decklistStatus: null,
    playerCount: 26,
    eventType: null,
    eventFormat: "Constructed",
    mappedFormat: "constructed",
    officialLabel: null,
    storeName: "CARD MASTER CLUB",
    location: null,
    timezone: null,
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-10-28T06:00:00.000Z",
    missingSince: null,
    missingProbe: null,
    nextCheckAt: null,
    checkStage: 0,
    triage: "new",
    metaEventId: null,
    metaEventSlug: null,
    fetchedAt: null,
    stagedPlayerCount: 0,
    stagedLegendCount: 0,
    stagedDeckCount: 0,
    sourceUrl: "https://example.invalid/events/923368",
    ...overrides,
  };
}

describe("uvsgamesMirrorRow", () => {
  it("gives an undecided row no results state", () => {
    const row = uvsgamesMirrorRow(uvsgames(), { constructed: "Constructed" }, NOW);

    expect(row).toMatchObject({
      key: "923368",
      venue: "CARD MASTER CLUB",
      atSource: { label: "Complete" },
      results: null,
      resultsDetail: [],
      unmappedFormat: null,
    });
    expect(row.badges.map((badge) => badge.label)).toEqual(["Constructed"]);
  });

  it("reads a published row's results the way the buckets do", () => {
    const row = uvsgamesMirrorRow(
      uvsgames({
        triage: "accepted",
        metaEventId: "live-1",
        stagedPlayerCount: 26,
        stagedDeckCount: 8,
      }),
      {},
      NOW,
    );

    expect(row.results).toBe("final");
    expect(row.resultsDetail).toEqual(["26 standings", "8 decks"]);
  });

  it("asks for a format pick when nothing maps the source's format", () => {
    const row = uvsgamesMirrorRow(uvsgames({ mappedFormat: null, eventFormat: "Draft" }), {}, NOW);

    expect(row.unmappedFormat).toBe("Draft");
    expect(row.badges[0]).toMatchObject({ label: "Draft, unmapped", variant: "warning" });
  });

  it("tells a probed-but-unlisted event from one gone from the source", () => {
    const missingSince = "2026-10-12T06:00:00.000Z";
    const found = uvsgamesMirrorRow(uvsgames({ missingSince, missingProbe: "found" }), {}, NOW);
    const absent = uvsgamesMirrorRow(uvsgames({ missingSince, missingProbe: "absent" }), {}, NOW);

    expect(found.badges.at(-1)?.label).toBe("Only reachable by id");
    expect(absent.badges.at(-1)?.label).toBe("Gone from the source");
  });
});

describe("other sources", () => {
  it("compares a calendar-day start against today", () => {
    const row = playloltcgMirrorRow(
      {
        activityShopId: 202_679,
        name: "高校展位拉新",
        shopName: "Shop",
        city: "武汉市",
        status: 1,
        battleMode: "1v1",
        playerCount: 0,
        startAt: "2026-12-05",
        triage: "accepted",
        metaEventId: "live-2",
        metaEventSlug: null,
        fetchedAt: null,
        missingSince: null,
        nextCheckAt: null,
        stagedPlayerCount: 0,
        stagedLegendCount: 0,
        stagedDeckCount: 0,
        sourceUrl: "https://example.invalid/202679",
      } satisfies PlayloltcgCatalogRow,
      NOW,
    );

    expect(row).toMatchObject({ startIsDay: true, results: "notStarted", collects: true });
    expect(row.atSource?.label).toBe("Reg open");
  });

  it("never collects for a source whose refresh carries the results", () => {
    const row = topdeckMirrorRow(
      {
        tid: "riftbound-locals-1026",
        name: "Riftbound Locals 10/26",
        format: "Constructed",
        city: null,
        country: null,
        playerCount: 22,
        topCut: 0,
        isTeamEvent: false,
        startAt: "2026-10-26T23:00:00.000Z",
        triage: "accepted",
        metaEventId: "live-3",
        metaEventSlug: null,
        fetchedAt: null,
        missingSince: null,
        stagedPlayerCount: 22,
        stagedLegendCount: 0,
        stagedDeckCount: 0,
        rivalProvider: null,
        sourceUrl: "https://example.invalid/t",
      } satisfies TopdeckCatalogRow,
      NOW,
    );

    expect(row).toMatchObject({ results: "final", collects: false, venue: null });
    expect(row.resultsDetail).toEqual(["22 standings"]);
  });

  it("reads registrations against places and the round the event is on", () => {
    const row = playriftboundMirrorRow(
      {
        tournamentId: "117451802123511056",
        name: "Riftbound Wednesday Nexus Nights - 28 Oct 2026",
        organizerName: "Vault of Delights",
        city: null,
        tournamentType: "NEXUS_NIGHT",
        format: null,
        playerFormat: "ONE_V_ONE",
        registeredCount: 16,
        participantCapacity: 16,
        startAt: "2026-10-28T15:30:00.000Z",
        triage: "accepted",
        metaEventId: "live-4",
        metaEventSlug: null,
        fetchedAt: null,
        missingSince: null,
        nextCheckAt: "2026-10-31T15:30:00.000Z",
        roundCount: 4,
        roundsPlayed: 1,
        roundsFinalized: 0,
        stagedPlayerCount: 16,
        stagedMatchCount: 0,
        sourceUrl: "https://example.invalid/r",
      } satisfies PlayriftboundCatalogRow,
      NOW,
    );

    expect(row).toMatchObject({
      players: 16,
      capacity: 16,
      atSource: { label: "Round 1 of 4" },
      results: "collecting",
    });
    expect(row.resultsDetail).toEqual(["16 standings", "1 round open"]);
    expect(row.badges.map((badge) => badge.label)).toEqual(["Nexus Night"]);
  });
});
