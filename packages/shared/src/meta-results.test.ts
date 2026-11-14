import { describe, expect, it } from "vitest";

import { metaResultsState, mirrorResultsState } from "./meta-results.js";

describe("metaResultsState", () => {
  const today = "2026-11-13";
  const event = (
    status: "upcoming" | "in_progress" | "complete",
    playerRowCount: number,
    eventDate = "2026-11-01",
  ) => ({ status, playerRowCount, eventDate });

  it("reads an upcoming event as not started, whatever it holds", () => {
    expect(metaResultsState(event("upcoming", 0), today)).toBe("notStarted");
    expect(metaResultsState(event("upcoming", 12), today)).toBe("notStarted");
  });

  it("reads an event dated after today as not started, whatever its status", () => {
    expect(metaResultsState(event("complete", 0, "2026-11-14"), today)).toBe("notStarted");
    expect(metaResultsState(event("in_progress", 0, "2026-11-14"), today)).toBe("notStarted");
  });

  it("reads a running event as collecting", () => {
    expect(metaResultsState(event("in_progress", 0), today)).toBe("collecting");
    expect(metaResultsState(event("in_progress", 0, today), today)).toBe("collecting");
  });

  it("splits a finished event on whether it holds standings", () => {
    expect(metaResultsState(event("complete", 82), today)).toBe("final");
    expect(metaResultsState(event("complete", 0), today)).toBe("noResults");
  });
});

describe("mirrorResultsState", () => {
  const now = "2026-10-28T17:00:00.000Z";

  it("splits a published mirror row the way the bucket counts do", () => {
    expect(mirrorResultsState({ started: false, hasResults: true, nextCheckAt: null })).toBe(
      "notStarted",
    );
    expect(mirrorResultsState({ started: true, hasResults: false, nextCheckAt: now })).toBe(
      "collecting",
    );
    expect(mirrorResultsState({ started: true, hasResults: true, nextCheckAt: null })).toBe(
      "final",
    );
    expect(mirrorResultsState({ started: true, hasResults: false, nextCheckAt: null })).toBe(
      "noResults",
    );
  });
});
