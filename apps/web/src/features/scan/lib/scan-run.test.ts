import { describe, expect, it } from "vitest";

import type { PendingFrame } from "./scan-catchup";
import { idlePaceStart } from "./scan-pacing";
import { createScanRun } from "./scan-run";

const PENDING: PendingFrame = {
  frame: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
  thumbnail: null,
};

function busyRun() {
  const run = createScanRun("single");
  run.relock.note("art-a", 100);
  run.recentBoardAdds.note("art-a", 100);
  run.pile.noteLock(100);
  run.tally.notePlacement(100);
  run.rotation.note(1);
  run.rotation.note(1);
  run.aimStreaks.touch("art-a", 100);
  run.settling = { disturbed: true, at: 100 };
  run.pendingFrame = PENDING;
  run.sweeping = true;
  run.still = true;
  run.capturing = true;
  run.switching = true;
  run.cardInGuide = true;
  run.idlePace = { streak: 5, lastTotalMs: 500 };
  run.frameIndex = 42;
  run.startedAt = 1;
  return run;
}

describe("createScanRun", () => {
  it("starts empty in the mode it was made for", () => {
    const run = createScanRun("capture");

    expect(run.mode).toBe("capture");
    expect(run.pendingFrame).toBeNull();
    expect(run.sweeping).toBe(false);
    expect(run.tally.placements()).toBe(0);
    expect(run.rotation.turns()).toBe(0);
    expect(run.relock.allows("art-a")).toBe(true);
  });

  it("clears the session state on resetSession and keeps what the scene built up", () => {
    const run = busyRun();

    run.resetSession(5000);

    expect(run.settling).toEqual({ disturbed: false, at: 0 });
    expect(run.pendingFrame).toBeNull();
    expect(run.sweeping).toBe(false);
    expect(run.still).toBe(false);
    expect(run.capturing).toBe(false);
    expect(run.switching).toBe(false);
    expect(run.cardInGuide).toBe(false);
    expect(run.idlePace).toEqual(idlePaceStart());
    expect(run.aimStreaks.take("art-a", 200)).toBeNull();
    expect(run.frameIndex).toBe(0);
    expect(run.startedAt).toBe(5000);

    expect(run.relock.allows("art-a")).toBe(false);
    expect(run.recentBoardAdds.seen("art-a", 200)).toBe(true);
    expect(run.pile.lockedSince(100)).toBe(true);
    expect(run.tally.placements()).toBe(1);
    expect(run.rotation.turns()).toBe(1);
  });

  it("clears everything on reset", () => {
    const run = busyRun();

    run.reset(5000);

    expect(run.pendingFrame).toBeNull();
    expect(run.sweeping).toBe(false);
    expect(run.startedAt).toBe(5000);
    expect(run.relock.allows("art-a")).toBe(true);
    expect(run.recentBoardAdds.seen("art-a", 200)).toBe(false);
    expect(run.pile.lockedSince(0)).toBe(false);
    expect(run.tally.placements()).toBe(0);
    expect(run.rotation.turns()).toBe(0);
  });

  it("leaves the mode to whoever builds the sessions", () => {
    const run = createScanRun("single");
    run.mode = "capture";

    run.reset(0);

    expect(run.mode).toBe("capture");
  });
});
