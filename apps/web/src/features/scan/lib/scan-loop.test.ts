import type { ArtTrack } from "@openrift/shared/scan/accept";
import type { BoardCard } from "@openrift/shared/scan/board";
import type { PlacementSignal } from "@openrift/shared/scan/placement";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";
import { describe, expect, it, vi } from "vitest";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { createScanLoop } from "@/features/scan/lib/scan-loop";
import { createScanRun } from "@/features/scan/lib/scan-run";

const FRAME = { width: 640, height: 480 };
const STILL: RgbaImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

function setup(readBoard: () => Promise<BoardCard[] | null> = () => Promise.resolve(null)) {
  const run = createScanRun("single");
  const loop = createScanLoop<PendingFrame>({ run: () => run, idleGate: () => 0.5, readBoard });
  return { run, loop };
}

function track(artKey: string): ArtTrack {
  return { key: `${artKey}-key`, artKey, label: artKey } as ArtTrack;
}

function outcome(patch: Partial<FrameOutcome> = {}): FrameOutcome {
  return {
    winner: null,
    ranked: [],
    locked: null,
    sweeping: false,
    still: false,
    timings: { total: 30 },
    ...patch,
  } as FrameOutcome;
}

function twoCardsInGuide(): CardCandidate[] {
  const [topLeft, , bottomRight] = centeredGuideQuad(FRAME.width, FRAME.height);
  const width = (bottomRight.x - topLeft.x) / 3;
  const height = (bottomRight.y - topLeft.y) / 3;
  const top = topLeft.y + 10;
  return [topLeft.x + 10, bottomRight.x - 10 - width].map((left) => ({
    quad: [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ],
    areaFraction: 0,
    score: 0.9,
  }));
}

function card(artKey: string): BoardCard {
  return { key: `${artKey}-key`, artKey } as BoardCard;
}

const QUIET = { disturbed: false, placed: false } as PlacementSignal;
const BUSY_GUIDE = { ranked: [{ key: "a", distance: 0.1, rotation: 0 }] };

describe("createScanLoop — frames", () => {
  it("blocks frames only while a fresh placement settles and no sweep runs", () => {
    const { run, loop } = setup();
    run.update({ settling: { disturbed: true, at: 1000 } });
    expect(loop.frameBlocked(1001)).toBe(true);
    run.update({ sweeping: true });
    expect(loop.frameBlocked(1001)).toBe(false);
  });

  it("counts a winner, or a top match inside the idle gate, as a card in the guide", () => {
    const { run, loop } = setup();
    const near = outcome({ ranked: [{ key: "a", distance: 0.4, rotation: 0 }] });
    expect(loop.noteOutcome(near, 0).cardInGuide).toBe(true);
    expect(run.cardInGuide).toBe(true);
    const far = outcome({ ranked: [{ key: "a", distance: 0.6, rotation: 0 }] });
    expect(loop.noteOutcome(far, 10).cardInGuide).toBe(false);
  });

  it("passes a first lock and suppresses the same artwork while the guide stays busy", () => {
    const { loop } = setup();
    const first = loop.noteOutcome(outcome({ ...BUSY_GUIDE, locked: track("art-a") }), 0);
    expect(first.lock?.artKey).toBe("art-a");
    const again = loop.noteOutcome(outcome({ ...BUSY_GUIDE, locked: track("art-a") }), 100);
    expect(again).toMatchObject({ lock: null, suppressed: "relock" });
  });
});

describe("createScanLoop — board reads", () => {
  it("reads after two quiet surveys of several cards and holds those artworks back from sweeps", async () => {
    const { run, loop } = setup(() => Promise.resolve([card("art-a"), card("art-b")]));
    const surveyed = outcome({ survey: twoCardsInGuide() });
    expect(loop.boardReadDue(surveyed, FRAME, 0)).toBe(false);
    expect(loop.boardReadDue(surveyed, FRAME, 1000)).toBe(true);

    const result = await loop.readBoard(STILL, () => 1000);

    expect(result?.fresh.map((entry) => entry.artKey)).toEqual(["art-a", "art-b"]);
    const swept = loop.noteOutcome(outcome({ sweeping: true, locked: track("art-a") }), 2000);
    expect(swept.suppressed).toBe("board");
    expect(run.recentBoardAdds.seen("art-b", 2000)).toBe(true);
  });

  it("never reads while a sweep runs", () => {
    const { loop } = setup();
    const sweeping = outcome({ survey: twoCardsInGuide(), sweeping: true });
    expect(loop.boardReadDue(sweeping, FRAME, 0)).toBe(false);
    expect(loop.boardReadDue(sweeping, FRAME, 1000)).toBe(false);
  });

  it("notes nothing when the read no longer belongs to the session", async () => {
    const { run, loop } = setup();
    expect(await loop.readBoard(STILL, () => 0)).toBeNull();
    expect(run.recentBoardAdds.seen("art-a", 0)).toBe(false);
  });

  it("does not add an artwork twice when the same view is read again", async () => {
    const { loop } = setup(() => Promise.resolve([card("art-a")]));
    const first = await loop.readBoard(STILL, () => 0);
    const second = await loop.readBoard(STILL, () => 10);
    expect(first?.fresh).toHaveLength(1);
    expect(second?.fresh).toHaveLength(0);
  });
});

describe("createScanLoop — placements", () => {
  it("ignores placements while the camera moves in single mode", () => {
    const { loop } = setup();
    const takeFrame = vi.fn(() => null);
    expect(loop.observePlacement({ ...QUIET, placed: true }, 0, takeFrame)).toEqual({
      missed: false,
      missedFrame: null,
      confirmed: false,
    });
    expect(takeFrame).not.toHaveBeenCalled();
  });

  it("records the settling state on every observed frame", () => {
    const { run, loop } = setup();
    loop.observePlacement({ ...QUIET, disturbed: true }, 500, () => null);
    expect(run.settling).toEqual({ disturbed: true, at: 500 });
  });

  it("settles one missed placement when a catch-up adds its card", () => {
    const { run, loop } = setup();
    run.tally.notePlacement(0);
    expect(run.tally.takeMiss(10_000)).toBe(true);
    loop.noteCatchUpAdd("art-a", 10_000);
    expect(run.tally.missedTotal()).toBe(0);
    expect(run.relock.allows("art-a")).toBe(false);
  });
});
