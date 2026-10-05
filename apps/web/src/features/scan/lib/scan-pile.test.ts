import { describe, expect, it } from "vitest";

import { createPileState } from "./scan-pile";

describe("createPileState", () => {
  it("starts with no lock and no placement", () => {
    const pile = createPileState();
    expect(pile.lockedSince(0)).toBe(false);
    expect(pile.placedSinceLock()).toBe(false);
  });

  it("reports a lock that landed after a settle", () => {
    const pile = createPileState();
    pile.noteLock(1200);
    expect(pile.lockedSince(1000)).toBe(true);
    expect(pile.lockedSince(1500)).toBe(false);
  });

  it("clears the placement once a lock answers it", () => {
    const pile = createPileState();
    pile.notePlacement();
    expect(pile.placedSinceLock()).toBe(true);
    pile.noteLock(10);
    expect(pile.placedSinceLock()).toBe(false);
  });

  it("forgets everything on reset", () => {
    const pile = createPileState();
    pile.noteLock(10);
    pile.notePlacement();
    pile.reset();
    expect(pile.lockedSince(0)).toBe(false);
    expect(pile.placedSinceLock()).toBe(false);
  });
});
