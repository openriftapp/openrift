import type { AdminMetaSourceState } from "@openrift/shared/contracts/admin/meta";
import { describe, expect, it } from "vitest";

import { cancelledAtSourceText, sourceStateLifecycle } from "./meta-event-source-state";

function state(overrides: Partial<AdminMetaSourceState> = {}): AdminMetaSourceState {
  return {
    provider: "uvsgames",
    externalId: "857112",
    status: "canceled",
    cancelled: true,
    missingSince: null,
    roundsPlayed: null,
    roundCount: null,
    results: "noResults",
    nextCheckAt: null,
    collects: true,
    ...overrides,
  };
}

describe("sourceStateLifecycle", () => {
  it("reads each source's own lifecycle", () => {
    expect(sourceStateLifecycle(state())?.label).toBe("Canceled");
    expect(sourceStateLifecycle(state({ provider: "playloltcg", status: "5" }))?.label).toBe(
      "Finished",
    );
    expect(
      sourceStateLifecycle(
        state({ provider: "playriftbound", status: null, roundsPlayed: 1, roundCount: 4 }),
      )?.label,
    ).toBe("Round 1 of 4");
  });

  it("shows nothing for a source that publishes no lifecycle", () => {
    expect(sourceStateLifecycle(state({ provider: "topdeck", status: null }))).toBeNull();
  });
});

describe("cancelledAtSourceText", () => {
  it("says nothing keeps a bare cancelled event", () => {
    expect(cancelledAtSourceText(state(), 0, 0)).toBe(
      "UVS Games lists this event as cancelled. It has no standings and no other source.",
    );
  });

  it("names what keeps it published", () => {
    expect(cancelledAtSourceText(state(), 12, 1)).toBe(
      "UVS Games lists this event as cancelled. It still has 12 standings and 1 other source.",
    );
  });
});
