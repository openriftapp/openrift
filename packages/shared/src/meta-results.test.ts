import { describe, expect, it } from "vitest";

import { metaResultsState, mirrorResultsState } from "./meta-results.js";

describe("metaResultsState", () => {
  it("reads an upcoming event as not started, whatever it holds", () => {
    expect(metaResultsState("upcoming", 0)).toBe("notStarted");
    expect(metaResultsState("upcoming", 12)).toBe("notStarted");
  });

  it("reads a running event as collecting", () => {
    expect(metaResultsState("in_progress", 0)).toBe("collecting");
  });

  it("splits a finished event on whether it holds standings", () => {
    expect(metaResultsState("complete", 82)).toBe("final");
    expect(metaResultsState("complete", 0)).toBe("noResults");
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
