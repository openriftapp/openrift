import { describe, expect, it } from "vitest";

import type { MetaResultsState } from "./meta-results.js";
import {
  metaEventSourceStarted,
  metaEventStatus,
  metaResultsState,
  mirrorResultsState,
} from "./meta-results.js";

const TODAY = "2026-11-13";
const DATES = ["2026-11-11", "2026-11-12", TODAY, "2026-11-14", "2026-11-15"] as const;

type Recorded = "upcoming" | "in_progress" | "complete";

const STATES_BY_DATE: Record<Recorded, Record<0 | 5, MetaResultsState[]>> = {
  upcoming: {
    0: ["noResults", "collecting", "collecting", "collecting", "notStarted"],
    5: ["final", "collecting", "collecting", "collecting", "notStarted"],
  },
  in_progress: {
    0: ["collecting", "collecting", "collecting", "collecting", "notStarted"],
    5: ["collecting", "collecting", "collecting", "collecting", "notStarted"],
  },
  complete: {
    0: ["noResults", "noResults", "noResults", "notStarted", "notStarted"],
    5: ["final", "final", "final", "final", "notStarted"],
  },
};

const STATUS_OF_STATE: Record<MetaResultsState, string> = {
  notStarted: "upcoming",
  collecting: "in_progress",
  final: "complete",
  noResults: "complete",
};

describe("metaResultsState over the day-either-side window", () => {
  for (const recordedStatus of ["upcoming", "in_progress", "complete"] as const) {
    for (const playerRowCount of [0, 5] as const) {
      it(`reads a ${recordedStatus} event holding ${playerRowCount} rows by its date`, () => {
        const states = DATES.map((eventDate) =>
          metaResultsState({ recordedStatus, eventDate, playerRowCount }, TODAY),
        );
        expect(states).toEqual(STATES_BY_DATE[recordedStatus][playerRowCount]);
      });

      it(`gives a ${recordedStatus} event holding ${playerRowCount} rows the status its state names`, () => {
        const statuses = DATES.map((eventDate) =>
          metaEventStatus({ recordedStatus, eventDate, playerRowCount }, TODAY),
        );
        expect(statuses).toEqual(
          STATES_BY_DATE[recordedStatus][playerRowCount].map((state) => STATUS_OF_STATE[state]),
        );
      });
    }
  }
});

describe("metaEventSourceStarted", () => {
  it("is false only while the source still records the event as upcoming", () => {
    expect(metaEventSourceStarted({ recordedStatus: "upcoming" })).toBe(false);
    expect(metaEventSourceStarted({ recordedStatus: "in_progress" })).toBe(true);
    expect(metaEventSourceStarted({ recordedStatus: "complete" })).toBe(true);
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
