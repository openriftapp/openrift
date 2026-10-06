import type { ArtTrack } from "@openrift/shared/scan/accept";
import type { PlacementSignal } from "@openrift/shared/scan/placement";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { Quad, RgbaImage } from "@openrift/shared/scan/types";
import { describe, expect, it } from "vitest";

import type { ReplayDeps } from "@/features/admin/lib/scan-device-bench";
import {
  everyNthFrame,
  frameWindows,
  realtimePacing,
  recordedPacing,
  replayClip,
  summarizeSpeed,
} from "@/features/admin/lib/scan-device-bench";

const FRAME: RgbaImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

function signal(overrides: Partial<PlacementSignal> = {}): PlacementSignal {
  return {
    delta: 0,
    disturbed: false,
    placed: false,
    settled: false,
    disturbedFrames: 0,
    changedDelta: 0,
    ...overrides,
  };
}

function signalsAt(frames: Record<number, Partial<PlacementSignal>>): ReplayDeps["watch"] {
  let index = 0;
  return () => signal(frames[index++]);
}

function outcome(overrides: Partial<FrameOutcome> = {}): FrameOutcome {
  return {
    candidate: null,
    ranked: [],
    winner: null,
    refused: false,
    bestScore: 0,
    sweeping: false,
    still: false,
    locked: null,
    winnerRun: null,
    focus: 0,
    timings: { detect: 1, embed: 2, verify: 3, total: 6, crop: 0 },
    ...overrides,
  };
}

function track(artKey: string): ArtTrack {
  return {
    artKey,
    key: `${artKey}-en`,
    label: artKey,
    firstSeen: 0,
    sightings: 3,
    runLength: 3,
    runWeight: 3,
    lockedThisRun: true,
    lastFrame: 0,
    lockedAt: 0,
    framesToLock: 2,
    printingResolved: false,
    runStartFrame: 0,
    runStartSeconds: 0,
    maxRunLength: 3,
  };
}

function deps(overrides: Partial<ReplayDeps> & { processMs?: number } = {}): ReplayDeps {
  let clock = 0;
  const processMs = overrides.processMs ?? 10;
  return {
    frameCount: 10,
    fps: 10,
    loadFrame: async () => FRAME,
    watch: () => signal(),
    process: async () => {
      clock += processMs;
      return outcome();
    },
    rearm: () => {},
    multiPrinting: () => false,
    labelOf: (key) => `label ${key}`,
    idleGate: 0.5,
    now: () => clock,
    pacing: realtimePacing(),
    ...overrides,
  };
}

const AHRI_LOCK = {
  locked: track("ahri"),
  winner: { key: "ahri-en", artKey: "ahri", score: 30, rivalScore: 0 },
};
const PLAUSIBLE = { ranked: [{ key: "ahri-en", distance: 0.2, rotation: 0 }] };

/** Frames carry their index as width, so a catch-up can tell which frame it got. */
async function indexedFrame(index: number): Promise<RgbaImage> {
  return { data: new Uint8ClampedArray(4), width: index, height: 1 };
}

function catchUpRecorder(result: Partial<FrameOutcome> = {}) {
  const frames: number[] = [];
  const catchUp: ReplayDeps["catchUp"] = async (frame) => {
    frames.push(frame.width);
    return outcome(result);
  };
  return { frames, catchUp };
}

describe("replayClip", () => {
  it("drops frames that arrive while the device is still busy", async () => {
    const seen: number[] = [];
    let clock = 0;
    const result = await replayClip(
      deps({
        now: () => clock,
        process: async (_frame, _index, seconds) => {
          seen.push(seconds);
          clock += 250;
          return outcome();
        },
      }),
    );
    expect(seen).toEqual([0, 0.3, 0.6, 0.9]);
    expect(result.processed).toBe(4);
    expect(result.skipped).toBe(6);
    expect(result.frameMs).toEqual([250, 250, 250, 250]);
  });

  it("waits out the app's idle pace after a run of slow frames with nothing in the guide", async () => {
    const seen: number[] = [];
    await replayClip(
      deps({
        frameCount: 9,
        fps: 4,
        now: () => 0,
        process: async (_frame, _index, seconds) => {
          seen.push(seconds);
          return outcome({ timings: { detect: 0, embed: 0, verify: 0, total: 500, crop: 0 } });
        },
      }),
    );
    expect(seen).toEqual([0, 0.25, 0.5, 0.75, 1, 1.5, 2]);
  });

  it("runs every nth frame however long each took", async () => {
    const seen: number[] = [];
    let clock = 0;
    await replayClip(
      deps({
        now: () => clock,
        pacing: everyNthFrame(3),
        process: async (_frame, index, seconds) => {
          seen.push(seconds);
          expect(index).toBe(seen.length - 1);
          clock += 1000;
          return outcome({ timings: { detect: 0, embed: 0, verify: 0, total: 1000, crop: 0 } });
        },
      }),
    );
    expect(seen).toEqual([0, 0.3, 0.6, 0.9]);
  });

  it("averages the stage timings over processed frames", async () => {
    const result = await replayClip(deps({ frameCount: 3 }));
    expect(result.stageMs).toEqual({ detect: 1, embed: 2, verify: 3, printing: 0 });
  });

  it("reports the share of processed frames that swept", async () => {
    let call = 0;
    const result = await replayClip(
      deps({
        frameCount: 4,
        process: async () => outcome({ sweeping: call++ === 0 }),
      }),
    );
    expect(result.sweepShare).toBe(0.25);
  });

  it("skips disturbed frames and dates locks from the arrival", async () => {
    const disturbed = new Set([2, 3]);
    let watched = 0;
    let clock = 0;
    const result = await replayClip(
      deps({
        now: () => clock,
        watch: () => signal({ disturbed: disturbed.has(watched++) }),
        process: async (_frame, _index, seconds) => {
          clock += 10;
          return seconds === 0.5 ? outcome(AHRI_LOCK) : outcome();
        },
      }),
    );
    expect(result.processed).toBe(8);
    expect(result.locks).toHaveLength(1);
    expect(result.locks[0]).toMatchObject({ seconds: 0.5, arrivedAt: 0.2, framesToLock: 2 });
  });

  it("processes disturbed frames when told not to skip them", async () => {
    const result = await replayClip(
      deps({
        watch: () => signal({ disturbed: true }),
        behaviour: { skipDisturbed: false },
      }),
    );
    expect(result.processed).toBe(10);
  });

  it("ignores disturbance while the session sweeps", async () => {
    let sweeping = false;
    const result = await replayClip(
      deps({
        watch: () => signal({ disturbed: sweeping }),
        process: async () => {
          sweeping = true;
          return outcome({ sweeping: true });
        },
      }),
    );
    expect(result.processed).toBe(10);
  });

  it("rearms on a placement only while the camera is still", async () => {
    let rearms = 0;
    const still = await replayClip(
      deps({
        watch: signalsAt({ 1: { placed: true } }),
        process: async () => outcome({ still: true }),
        rearm: () => rearms++,
      }),
    );
    expect(rearms).toBe(1);
    expect(still.placements).toBe(1);
    rearms = 0;
    await replayClip(deps({ watch: signalsAt({ 1: { placed: true } }), rearm: () => rearms++ }));
    expect(rearms).toBe(0);
  });

  it("counts a placement without rearming when rearming is off", async () => {
    let rearms = 0;
    const result = await replayClip(
      deps({
        watch: signalsAt({ 1: { placed: true } }),
        process: async () => outcome({ still: true }),
        rearm: () => rearms++,
        behaviour: { rearm: false },
      }),
    );
    expect(rearms).toBe(0);
    expect(result.placements).toBe(1);
  });

  it("does not rearm on a settle the hand disturbs again", async () => {
    let rearms = 0;
    await replayClip(
      deps({
        watch: signalsAt({ 1: { placed: true }, 3: { disturbed: true } }),
        process: async () => outcome({ still: true }),
        rearm: () => rearms++,
      }),
    );
    expect(rearms).toBe(0);
  });

  it("does not count a placement a lock already answered", async () => {
    let rearms = 0;
    let call = 0;
    await replayClip(
      deps({
        watch: signalsAt({ 1: { placed: true } }),
        process: async () => {
          call++;
          return call === 3 ? outcome({ still: true, ...AHRI_LOCK }) : outcome({ still: true });
        },
        rearm: () => rearms++,
      }),
    );
    expect(rearms).toBe(0);
  });

  it("does not count a lock the relock guard suppresses", async () => {
    const result = await replayClip(
      deps({
        process: async (_frame, index) =>
          index === 1 || index === 6 ? outcome(AHRI_LOCK) : outcome(PLAUSIBLE),
      }),
    );
    expect(result.locks.map((lock) => lock.seconds)).toEqual([0.1]);
    expect(result.suppressedRelocks).toBe(1);
  });

  it("counts a hand-held relock when the relock guard is off", async () => {
    const result = await replayClip(
      deps({
        process: async (_frame, index) =>
          index === 1 || index === 6 ? outcome(AHRI_LOCK) : outcome(PLAUSIBLE),
        behaviour: { relockGuard: false },
      }),
    );
    expect(result.locks.map((lock) => lock.seconds)).toEqual([0.1, 0.6]);
  });

  it("counts a relock once the guide has gone empty", async () => {
    const result = await replayClip(
      deps({
        frameCount: 40,
        process: async (_frame, index) =>
          index === 1 || index === 30 ? outcome(AHRI_LOCK) : outcome(),
      }),
    );
    expect(result.locks.map((lock) => lock.seconds)).toEqual([0.1, 3]);
  });

  it("renames a lock when its printing resolves on a later frame", async () => {
    let call = 0;
    const result = await replayClip(
      deps({
        frameCount: 2,
        process: async () => {
          call++;
          if (call === 1) {
            return outcome(AHRI_LOCK);
          }
          return outcome({
            printingTrack: { artKey: "ahri", key: "ahri-zh", label: "Ahri ZH", resolved: true },
            printingVia: "code",
            printingMargin: 0.2,
            candidate: {
              quad: [
                { x: 0, y: 0 },
                { x: 60, y: 0 },
                { x: 60, y: 90 },
                { x: 0, y: 84 },
              ],
              areaFraction: 0.5,
              score: 1,
            },
          });
        },
        multiPrinting: () => true,
      }),
    );
    expect(result.locks[0]).toMatchObject({
      key: "ahri-zh",
      label: "Ahri ZH",
      printingResolved: true,
      multiPrinting: true,
      printingVia: "code",
      printingMargin: 0.2,
      printingCardHeight: 90,
    });
  });

  describe("board reads", () => {
    const board = {
      survey: [
        { x: 110, y: 120 },
        { x: 210, y: 120 },
      ].map(({ x, y }) => ({
        quad: [
          { x, y },
          { x: x + 80, y },
          { x: x + 80, y: y + 110 },
          { x, y: y + 110 },
        ] as const satisfies Quad,
        areaFraction: 0.1,
        score: 1,
      })),
    };
    const frame: RgbaImage = { data: new Uint8ClampedArray(4), width: 400, height: 400 };

    it("counts a board read after two surveys with several cards in an empty guide", async () => {
      const result = await replayClip(
        deps({ frameCount: 3, loadFrame: async () => frame, process: async () => outcome(board) }),
      );
      expect(result.boardReads).toEqual([0.1]);
    });

    it("counts none without a board detector", async () => {
      const result = await replayClip(
        deps({
          frameCount: 3,
          loadFrame: async () => frame,
          process: async () => outcome(board),
          behaviour: { boardReads: false },
        }),
      );
      expect(result.boardReads).toEqual([]);
    });
  });

  describe("placements the live pass never names", () => {
    const stillFrames = async () => outcome({ still: true });

    it("hands the placement's frame to the catch-up once the miss grace is over", async () => {
      const { frames, catchUp } = catchUpRecorder();
      const result = await replayClip(
        deps({
          frameCount: 60,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true } }),
          process: stillFrames,
          catchUp,
        }),
      );
      expect(frames).toEqual([1]);
      expect(result.missedPlacements).toBe(1);
      expect(result.catchUpRuns).toBe(1);
    });

    it("leaves a placement alone while its grace runs", async () => {
      const { frames, catchUp } = catchUpRecorder();
      const result = await replayClip(
        deps({
          frameCount: 40,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true } }),
          process: stillFrames,
          catchUp,
        }),
      );
      expect(frames).toEqual([]);
      expect(result.missedPlacements).toBe(0);
    });

    it("replaces the pending frame when a second placement lands inside the grace", async () => {
      const { frames, catchUp } = catchUpRecorder();
      const result = await replayClip(
        deps({
          frameCount: 100,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true }, 20: { placed: true } }),
          process: stillFrames,
          catchUp,
        }),
      );
      expect(result.placements).toBe(2);
      expect(frames).toEqual([20]);
      expect(result.missedPlacements).toBe(1);
    });

    it("sends nothing to the catch-up once a lock names the placement", async () => {
      const { frames, catchUp } = catchUpRecorder();
      const result = await replayClip(
        deps({
          frameCount: 80,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true } }),
          process: async (_frame, index) =>
            index === 10 ? outcome({ still: true, ...AHRI_LOCK }) : outcome({ still: true }),
          catchUp,
        }),
      );
      expect(frames).toEqual([]);
      expect(result.missedPlacements).toBe(0);
    });

    it("holds the catch-up while a card sits in the guide or the scene settles", async () => {
      const { frames, catchUp } = catchUpRecorder();
      const seen: number[] = [];
      let watched = 0;
      await replayClip(
        deps({
          frameCount: 80,
          loadFrame: indexedFrame,
          watch: () => {
            const index = watched++;
            return signal({ placed: index === 1, disturbed: index >= 56 && index <= 60 });
          },
          process: async (frame) => {
            seen.push(frame.width);
            return outcome({ still: true, ...(frame.width < 55 ? PLAUSIBLE : {}) });
          },
          catchUp,
        }),
      );
      expect(frames).toEqual([1]);
      expect(seen.filter((index) => index >= 40 && index < 63)).toEqual([
        40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 62,
      ]);
    });

    it("spends a live frame slot on the catch-up", async () => {
      const { catchUp } = catchUpRecorder();
      const seen: number[] = [];
      const result = await replayClip(
        deps({
          frameCount: 60,
          loadFrame: indexedFrame,
          pacing: everyNthFrame(1),
          watch: signalsAt({ 1: { placed: true } }),
          process: async (frame) => {
            seen.push(frame.width);
            return outcome({ still: true });
          },
          catchUp,
        }),
      );
      expect(result.processed).toBe(59);
      expect(result.skipped).toBe(1);
      expect(seen).toHaveLength(59);
    });

    it("adds what the catch-up names and leaves an unsure one for the user", async () => {
      const named = catchUpRecorder({
        winner: { key: "ahri-en", artKey: "ahri", score: 90, rivalScore: 20 },
      });
      const added = await replayClip(
        deps({
          frameCount: 60,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true } }),
          process: stillFrames,
          catchUp: named.catchUp,
        }),
      );
      expect(added.locks).toEqual([
        expect.objectContaining({
          key: "ahri-en",
          label: "label ahri-en",
          source: "second-look",
          arrivedAt: 0.1,
          printingResolved: false,
        }),
      ]);
      expect(added.recoveredAsk).toBe(0);

      const unsure = catchUpRecorder({
        winner: { key: "ahri-en", artKey: "ahri", score: 60, rivalScore: 50 },
      });
      const asked = await replayClip(
        deps({
          frameCount: 60,
          loadFrame: indexedFrame,
          watch: signalsAt({ 1: { placed: true } }),
          process: stillFrames,
          catchUp: unsure.catchUp,
        }),
      );
      expect(asked.locks).toEqual([]);
      expect(asked.recoveredAsk).toBe(1);
    });

    it("still counts the miss without a catch-up session", async () => {
      const result = await replayClip(
        deps({
          frameCount: 60,
          watch: signalsAt({ 1: { placed: true } }),
          process: stillFrames,
        }),
      );
      expect(result.missedPlacements).toBe(1);
      expect(result.catchUpRuns).toBe(0);
      expect(result.processed).toBe(60);
    });
  });
});

describe("recordedPacing", () => {
  it("processes the clip frame nearest each frame the phone grabbed, and nothing else", async () => {
    const processed: number[] = [];
    await replayClip(
      deps({
        loadFrame: indexedFrame,
        process: async (frame) => {
          processed.push(frame.width);
          return outcome();
        },
        pacing: recordedPacing([0.01, 0.26, 0.29, 0.71], 10),
      }),
    );
    expect(processed).toEqual([0, 3, 7]);
  });
});

describe("frameWindows", () => {
  it("takes the whole clip when it is shorter than the windows", () => {
    expect(frameWindows(5, 2, 3)).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("centres consecutive runs on evenly spaced points", () => {
    expect(frameWindows(90, 2, 4)).toEqual([
      [28, 29, 30, 31],
      [58, 59, 60, 61],
    ]);
  });
});

describe("summarizeSpeed", () => {
  const sample = (sweep: boolean, total: number) => ({
    sweep,
    timings: { detect: total / 2, embed: total / 4, verify: total / 4, total, crop: 0 },
  });

  it("keeps aimed and sweep frames apart", () => {
    const summary = summarizeSpeed([sample(false, 40), sample(false, 20), sample(true, 80)]);
    expect(summary.aimed?.frames).toBe(2);
    expect(summary.aimed?.frame.mean).toBe(30);
    expect(summary.aimed?.stageMs.detect).toBe(15);
    expect(summary.sweep?.frames).toBe(1);
  });

  it("reports nothing for a kind without frames", () => {
    expect(summarizeSpeed([sample(true, 10)]).aimed).toBeNull();
  });
});
