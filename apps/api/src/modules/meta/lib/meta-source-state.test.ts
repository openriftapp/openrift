import { describe, expect, it } from "vitest";

import type { PlayloltcgListRow } from "../repositories/playloltcg-events.js";
import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";
import type { TopdeckListRow } from "../repositories/topdeck-events.js";
import type { UvsgamesListRow } from "../repositories/uvsgames-events.js";
import {
  playloltcgSourceState,
  playriftboundSourceState,
  topdeckSourceState,
  uvsgamesSourceState,
} from "./meta-source-state.js";

const NOW = new Date("2026-10-28T17:00:00Z");
const PAST = new Date("2026-10-24T18:00:00Z");

describe("source states", () => {
  it("flags a cancelled event", () => {
    const state = uvsgamesSourceState(
      {
        externalId: "857112",
        displayStatus: "canceled",
        startAt: PAST,
        missingSince: null,
        nextCheckAt: null,
      } as UvsgamesListRow,
      NOW,
    );

    expect(state).toMatchObject({ cancelled: true, results: "noResults", collects: true });
  });

  it("reads a calendar-day start against today", () => {
    const state = playloltcgSourceState(
      {
        activityShopId: 25_107,
        status: 5,
        startAt: "2026-10-28",
        missingSince: null,
        nextCheckAt: null,
      } as unknown as PlayloltcgListRow,
      NOW,
    );

    expect(state).toMatchObject({ externalId: "25107", status: "5", results: "final" });
  });

  it("never collects for a source whose refresh carries the results", () => {
    const state = topdeckSourceState(
      {
        tid: "riftbound-locals-1026",
        startAt: PAST,
        playerCount: 22,
        missingSince: null,
      } as TopdeckListRow,
      NOW,
    );

    expect(state).toMatchObject({ results: "final", nextCheckAt: null, collects: false });
  });

  it("carries the rounds a running event has played", () => {
    const state = playriftboundSourceState(
      {
        tournamentId: "117424000891345096",
        startAt: PAST,
        roundsPlayed: 1,
        roundCount: 4,
        missingSince: null,
        nextCheckAt: new Date("2026-10-31T15:30:00Z"),
      } as PlayriftboundListRow,
      NOW,
    );

    expect(state).toMatchObject({
      roundsPlayed: 1,
      roundCount: 4,
      results: "collecting",
      nextCheckAt: "2026-10-31T15:30:00.000Z",
    });
  });
});
