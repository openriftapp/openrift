import { describe, expect, it } from "vitest";

import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";
import { toPlayriftboundCatalogRow } from "./playriftbound-catalog-presenters.js";

const NOW = new Date("2026-10-18T12:00:00Z");

function row(overrides: Partial<PlayriftboundListRow> = {}): PlayriftboundListRow {
  return {
    tournamentId: "117000000000000001",
    organizerId: "org-1",
    name: "Nexus Night",
    startAt: new Date("2026-10-17T16:00:00Z"),
    tournamentType: "NEXUS_NIGHT",
    format: "CONSTRUCTED",
    playerFormat: "ONE_V_ONE",
    participantCapacity: 16,
    registeredCount: 10,
    waitlistedCount: 0,
    pricing: "FREE",
    entryFeeCurrency: null,
    entryFeeMinor: null,
    contentHash: "hash",
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    missingSince: null,
    structure: "SWISS",
    matchFormat: "BO1",
    roundCount: 4,
    roundsPlayed: 3,
    roundsFinalized: 3,
    sourceUpdatedAt: NOW,
    triage: "accepted",
    metaEventId: "live-1",
    metaEventSlug: "nexus-night",
    organizerName: "Bandle City Games",
    organizerCity: "Bandle City",
    organizerAddress: "1 Yordle Lane",
    organizerLongitude: 9.73,
    nextCheckAt: null,
    checkStage: 1,
    resultsFetchedAt: NOW,
    stagedPlayerCount: 10,
    stagedMatchCount: 15,
    ...overrides,
  };
}

describe("toPlayriftboundCatalogRow", () => {
  it("hands the table the store, the source vocabulary and round progress", () => {
    expect(toPlayriftboundCatalogRow(row())).toEqual({
      tournamentId: "117000000000000001",
      name: "Nexus Night",
      organizerName: "Bandle City Games",
      city: "Bandle City",
      tournamentType: "NEXUS_NIGHT",
      format: "CONSTRUCTED",
      playerFormat: "ONE_V_ONE",
      registeredCount: 10,
      participantCapacity: 16,
      startAt: "2026-10-17T16:00:00.000Z",
      triage: "accepted",
      metaEventId: "live-1",
      metaEventSlug: "nexus-night",
      fetchedAt: NOW.toISOString(),
      missingSince: null,
      nextCheckAt: null,
      roundCount: 4,
      roundsPlayed: 3,
      roundsFinalized: 3,
      stagedPlayerCount: 10,
      stagedMatchCount: 15,
      sourceUrl: "https://playriftbound.com/en-US/events/117000000000000001",
    });
  });
});
