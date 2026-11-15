import { describe, expect, it } from "vitest";

import { metaEventStatus, metaResultsState, mirrorResultsState } from "./meta-results.js";

describe("metaEventStatus", () => {
  const today = "2026-11-13";

  it("reads an event dated after today as upcoming, whatever it stores", () => {
    expect(metaEventStatus({ status: "complete", eventDate: "2026-11-14" }, today)).toBe(
      "upcoming",
    );
    expect(metaEventStatus({ status: "in_progress", eventDate: "2026-11-14" }, today)).toBe(
      "upcoming",
    );
  });

  it("keeps the stored status from today on", () => {
    expect(metaEventStatus({ status: "complete", eventDate: today }, today)).toBe("complete");
    expect(metaEventStatus({ status: "in_progress", eventDate: "2026-11-01" }, today)).toBe(
      "in_progress",
    );
    expect(metaEventStatus({ status: "upcoming", eventDate: "2026-11-01" }, today)).toBe(
      "upcoming",
    );
  });
});

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
