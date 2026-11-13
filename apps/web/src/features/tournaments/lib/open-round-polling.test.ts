import { describe, expect, it } from "vitest";

import {
  deckCheckEntriesRefetchInterval,
  myDeckRefetchInterval,
  openRoundRefetchInterval,
} from "./open-round-polling";

describe("openRoundRefetchInterval", () => {
  it("polls while a round is reporting", () => {
    const interval = openRoundRefetchInterval({
      rounds: [{ status: "finalized" }, { status: "reporting" }],
    });
    expect(interval).toBeGreaterThan(0);
  });

  it("stops once every round is finalized", () => {
    expect(
      openRoundRefetchInterval({ rounds: [{ status: "finalized" }, { status: "finalized" }] }),
    ).toBe(false);
  });

  it("stops when there are no rounds", () => {
    expect(openRoundRefetchInterval({ rounds: [] })).toBe(false);
  });

  it("stops before the first fetch resolves", () => {
    expect(openRoundRefetchInterval(undefined)).toBe(false);
  });
});

describe("deckCheckEntriesRefetchInterval", () => {
  it("polls while a deck waits for review or an unlock", () => {
    expect(
      deckCheckEntriesRefetchInterval({
        entries: [
          { state: "checked", unlockRequestedAt: null },
          { state: "submitted", unlockRequestedAt: null },
        ],
      }),
    ).toBeGreaterThan(0);
    expect(
      deckCheckEntriesRefetchInterval({
        entries: [{ state: "approved", unlockRequestedAt: "2026-06-01T10:00:00Z" }],
      }),
    ).toBeGreaterThan(0);
  });

  it("stops when nothing waits on a judge", () => {
    expect(
      deckCheckEntriesRefetchInterval({
        entries: [
          { state: "checked", unlockRequestedAt: null },
          { state: "editable", unlockRequestedAt: null },
        ],
      }),
    ).toBe(false);
    expect(deckCheckEntriesRefetchInterval(undefined)).toBe(false);
  });
});

describe("myDeckRefetchInterval", () => {
  it("polls while the window is open and the deck is still in review", () => {
    expect(
      myDeckRefetchInterval({ entry: { state: "submitted", windowOpen: true } }),
    ).toBeGreaterThan(0);
    expect(
      myDeckRefetchInterval({ entry: { state: "editable", windowOpen: true } }),
    ).toBeGreaterThan(0);
  });

  it("stops once the window closes or the deck is settled", () => {
    expect(myDeckRefetchInterval({ entry: { state: "submitted", windowOpen: false } })).toBe(false);
    expect(myDeckRefetchInterval({ entry: { state: "checked", windowOpen: true } })).toBe(false);
    expect(myDeckRefetchInterval({ entry: { state: "withdrawn", windowOpen: true } })).toBe(false);
  });
});
