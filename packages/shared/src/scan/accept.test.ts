import { describe, expect, it } from "vitest";

import type { AcceptState } from "./accept";
import {
  MAX_FRAME_WEIGHT,
  continuesRun,
  observeWinner,
  alignedFrameWeight,
  pickAlignedWinner,
  rearmLockedTracks,
} from "./accept";

const OPTIONS = { lockRun: 3, maxGapFrames: 6 };
const ALIGNED = { minScore: 0.6, minMargin: 0.15 };

describe("continuesRun", () => {
  it("continues a run within the gap and breaks it past the gap", () => {
    expect(continuesRun({ lastFrame: 4 }, 10, OPTIONS)).toBe(true);
    expect(continuesRun({ lastFrame: 4 }, 11, OPTIONS)).toBe(false);
  });

  it("never continues a re-armed track", () => {
    expect(continuesRun({ lastFrame: Number.NEGATIVE_INFINITY }, 0, OPTIONS)).toBe(false);
  });
});

describe("observeWinner — printing on re-lock", () => {
  it("starts a re-lock unresolved, so a reprint does not inherit the last card's printing", () => {
    const options = { lockRun: 2, maxGapFrames: 2, relockOnlyAfterRearm: true };
    const state: AcceptState = new Map();
    const first = { key: "ogn-214", artKey: "rune", score: 40, rivalScore: 0 };
    observeWinner(state, 0, 0, first, "OGN-214", options);
    const locked = observeWinner(state, 1, 0, first, "OGN-214", options);
    if (!locked) {
      throw new Error("expected a lock");
    }
    locked.key = "ogn-214";
    locked.printingResolved = true;

    rearmLockedTracks(state);
    const second = { key: "sfd-r06", artKey: "rune", score: 40, rivalScore: 0 };
    observeWinner(state, 5, 0, second, "SFD-R06", options);
    const relocked = observeWinner(state, 6, 0, second, "SFD-R06", options);

    expect(relocked).toMatchObject({ key: "sfd-r06", label: "SFD-R06", printingResolved: false });
  });
});

describe("observeWinner", () => {
  const winner = (key: string, artKey: string) => ({
    key,
    artKey,
    score: 20,
    rivalScore: 0,
  });

  it("locks after a run of agreeing frames", () => {
    const state: AcceptState = new Map();
    expect(observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS)).toBeNull();
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS)).toBeNull();
    const locked = observeWinner(state, 4, 0.2, winner("a", "artA"), "A", OPTIONS);
    expect(locked?.artKey).toBe("artA");
    expect(locked?.framesToLock).toBe(4);
  });

  it("never locks on sightings scattered beyond the gap", () => {
    const state: AcceptState = new Map();
    for (const frame of [0, 20, 40, 60, 80]) {
      expect(observeWinner(state, frame, frame / 30, winner("a", "artA"), "A", OPTIONS)).toBeNull();
    }
    expect(state.get("artA")?.lockedAt).toBeNull();
    expect(state.get("artA")?.sightings).toBe(5);
  });

  it("aggregates printings of one artwork into a single track", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a-en", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a-sc", "artA"), "A", OPTIONS);
    const locked = observeWinner(state, 2, 0.1, winner("a-en", "artA"), "A", OPTIONS);
    expect(state.size).toBe(1);
    expect(locked?.sightings).toBe(3);
  });

  it("locks a fresh run after an interruption", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 100, 3.3, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 101, 3.4, winner("a", "artA"), "A", OPTIONS);
    const locked = observeWinner(state, 102, 3.4, winner("a", "artA"), "A", OPTIONS);
    expect(locked?.artKey).toBe("artA");
  });

  it("does not re-fire while the locked run keeps extending", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS)).not.toBeNull();
    expect(observeWinner(state, 3, 0.1, winner("a", "artA"), "A", OPTIONS)).toBeNull();
    expect(observeWinner(state, 4, 0.2, winner("a", "artA"), "A", OPTIONS)).toBeNull();
  });

  it("locks the same artwork again for a second copy after a gap", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS)).not.toBeNull();
    observeWinner(state, 100, 3.3, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 101, 3.4, winner("a", "artA"), "A", OPTIONS);
    const relocked = observeWinner(state, 102, 3.5, winner("a", "artA"), "A", OPTIONS);
    expect(relocked?.artKey).toBe("artA");
    expect(relocked?.framesToLock).toBe(2);
    expect(relocked?.lockedAt).toBeCloseTo(3.5);
  });

  it("locks a quickly swapped second copy after a re-arm", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS)).not.toBeNull();
    rearmLockedTracks(state);
    observeWinner(state, 4, 0.2, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 5, 0.2, winner("a", "artA"), "A", OPTIONS);
    const relocked = observeWinner(state, 6, 0.3, winner("a", "artA"), "A", OPTIONS);
    expect(relocked?.artKey).toBe("artA");
    expect(relocked?.framesToLock).toBe(2);
  });

  it("re-arm leaves an unlocked mid-run track untouched", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    rearmLockedTracks(state);
    const locked = observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS);
    expect(locked?.artKey).toBe("artA");
  });

  it("re-arm does not fire a lock without a fresh run", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", OPTIONS);
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", OPTIONS)).not.toBeNull();
    rearmLockedTracks(state);
    expect(observeWinner(state, 4, 0.2, winner("a", "artA"), "A", OPTIONS)).toBeNull();
    expect(observeWinner(state, 5, 0.2, winner("a", "artA"), "A", OPTIONS)).toBeNull();
  });

  it("counts a weighted run of strong frames as more than its frame count", () => {
    const state: AcceptState = new Map();
    const options = { ...OPTIONS, weighted: true };
    const strong = { key: "a", artKey: "artA", score: 95, rivalScore: 0 };
    const weight = alignedFrameWeight(strong, ALIGNED);
    expect(weight).toBe(MAX_FRAME_WEIGHT);
    expect(observeWinner(state, 0, 0, strong, "A", options, { weight })).toBeNull();
    expect(observeWinner(state, 1, 0.03, strong, "A", options, { weight })?.artKey).toBe("artA");
  });

  it("still needs the full run when the frames are marginal", () => {
    const state: AcceptState = new Map();
    const options = { ...OPTIONS, weighted: true };
    const marginal = { key: "a", artKey: "artA", score: 60, rivalScore: 40 };
    const weight = alignedFrameWeight(marginal, ALIGNED);
    expect(weight).toBe(1);
    expect(observeWinner(state, 0, 0, marginal, "A", options, { weight })).toBeNull();
    expect(observeWinner(state, 1, 0.03, marginal, "A", options, { weight })).toBeNull();
    expect(observeWinner(state, 2, 0.06, marginal, "A", options, { weight })?.artKey).toBe("artA");
  });

  it("under the re-lock gate a run break alone cannot count the card twice", () => {
    const state: AcceptState = new Map();
    const options = { ...OPTIONS, relockOnlyAfterRearm: true };
    observeWinner(state, 0, 0, winner("a", "artA"), "A", options);
    observeWinner(state, 1, 0, winner("a", "artA"), "A", options);
    expect(observeWinner(state, 2, 0.1, winner("a", "artA"), "A", options)).not.toBeNull();
    for (const frame of [100, 101, 102, 103]) {
      expect(observeWinner(state, frame, frame / 30, winner("a", "artA"), "A", options)).toBeNull();
    }
    rearmLockedTracks(state);
    observeWinner(state, 200, 6.6, winner("a", "artA"), "A", options);
    observeWinner(state, 201, 6.7, winner("a", "artA"), "A", options);
    expect(observeWinner(state, 202, 6.8, winner("a", "artA"), "A", options)?.artKey).toBe("artA");
  });

  it("under the re-lock gate a different card locking in between re-arms the first", () => {
    const state: AcceptState = new Map();
    const options = { ...OPTIONS, relockOnlyAfterRearm: true };
    const hold = (art: string, frames: number[]) =>
      frames.map((frame) =>
        observeWinner(state, frame, frame / 30, winner(art, art), art, options),
      );
    expect(hold("artA", [0, 1, 2]).at(-1)?.artKey).toBe("artA");
    expect(hold("artB", [5, 6, 7]).at(-1)?.artKey).toBe("artB");
    expect(hold("artA", [10, 11, 12]).at(-1)?.artKey).toBe("artA");
    expect(hold("artA", [13, 14, 15, 16, 17])).toEqual([null, null, null, null, null]);
  });

  it("measures lock latency from the run that locked, not the first sighting", () => {
    const state: AcceptState = new Map();
    observeWinner(state, 0, 0, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 100, 3.3, winner("a", "artA"), "A", OPTIONS);
    observeWinner(state, 101, 3.4, winner("a", "artA"), "A", OPTIONS);
    const locked = observeWinner(state, 102, 3.5, winner("a", "artA"), "A", OPTIONS);
    expect(locked?.framesToLock).toBe(2);
    expect(locked?.runStartSeconds).toBeCloseTo(3.3);
    expect(locked?.firstSeen).toBe(0);
  });

  it("keeps counting a run it may not lock without ever locking it", () => {
    const state: AcceptState = new Map();
    const blocked = { stateKey: "place-1", canLock: false };
    for (const frame of [0, 1, 2, 3]) {
      expect(
        observeWinner(state, frame, frame / 30, winner("a", "artA"), "A", OPTIONS, blocked),
      ).toBeNull();
    }
    const track = state.get("place-1");
    expect(track?.runLength).toBe(4);
    expect(track?.lockedAt).toBeNull();
    expect(
      observeWinner(state, 4, 4 / 30, winner("a", "artA"), "A", OPTIONS, { stateKey: "place-1" }),
    ).toBe(track);
  });
});

describe("pickAlignedWinner", () => {
  const artOf = (key: string) => key.split("-")[0] ?? key;

  it("accepts a clear best score and reports it as percent", () => {
    const decision = pickAlignedWinner(
      [
        { key: "ahri-en", score: 0.91 },
        { key: "teemo-en", score: 0.3 },
      ],
      artOf,
      ALIGNED,
    );
    expect(decision).toEqual({
      winner: { key: "ahri-en", artKey: "ahri", score: 91, rivalScore: 30 },
      refused: false,
    });
  });

  it("rejects a best score under the floor", () => {
    expect(pickAlignedWinner([{ key: "ahri-en", score: 0.5 }], artOf, ALIGNED)).toEqual({
      winner: null,
      refused: false,
    });
  });

  it("refuses when another artwork scores close", () => {
    const decision = pickAlignedWinner(
      [
        { key: "ahri-en", score: 0.8 },
        { key: "teemo-en", score: 0.7 },
      ],
      artOf,
      ALIGNED,
    );
    expect(decision.refused).toBe(true);
  });

  it("does not treat other printings of the same artwork as rivals", () => {
    const decision = pickAlignedWinner(
      [
        { key: "ahri-en", score: 0.8 },
        { key: "ahri-zh", score: 0.79 },
      ],
      artOf,
      ALIGNED,
    );
    expect(decision.winner?.rivalScore).toBe(0);
  });

  it("ignores scores that carry no verdict", () => {
    const decision = pickAlignedWinner(
      [
        { key: "ahri-en", score: Number.NaN },
        { key: "teemo-en", score: 0.9 },
      ],
      artOf,
      ALIGNED,
    );
    expect(decision.winner?.key).toBe("teemo-en");
  });
});

describe("alignedFrameWeight", () => {
  it("grows from 1 at the floor to the maximum near a perfect match", () => {
    const at = (score: number) =>
      alignedFrameWeight({ key: "a", artKey: "a", score, rivalScore: 0 }, ALIGNED);
    expect(at(60)).toBe(1);
    expect(at(95)).toBe(MAX_FRAME_WEIGHT);
    expect(at(78)).toBeGreaterThan(1);
    expect(at(78)).toBeLessThan(MAX_FRAME_WEIGHT);
  });
});
