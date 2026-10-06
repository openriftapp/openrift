import type { FrameWinner } from "@openrift/shared/scan/accept";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { RgbaImage } from "@openrift/shared/scan/types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScanCatchUpOptions } from "@/features/scan/hooks/use-scan-catchup";
import { useScanCatchUp } from "@/features/scan/hooks/use-scan-catchup";
import type { IdentifyAttempt, PendingFrame } from "@/features/scan/lib/scan-catchup";
import type { LockedCard } from "@/features/scan/lib/scan-locks";
import { createScanLoop } from "@/features/scan/lib/scan-loop";
import { createScanRun } from "@/features/scan/lib/scan-run";

const FRAME: RgbaImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

function outcome(winner: FrameWinner | null): FrameOutcome {
  return {
    winner,
    ranked: [{ key: "k-a", distance: 0.1, rotation: 0 }],
    timings: { total: 50 },
  } as FrameOutcome;
}

function mount(processFrame: ScanCatchUpOptions["processFrame"]) {
  const onLock = vi.fn<(lock: LockedCard) => void>();
  const runGenerationRef = { current: 0 };
  const run = createScanRun("single");
  const loop = createScanLoop<PendingFrame>({
    run: () => run,
    idleGate: () => 0.5,
    readBoard: async () => null,
  });
  const hook = renderHook(() =>
    useScanCatchUp({
      bank: null,
      loop: () => loop,
      videoRef: { current: document.createElement("video") },
      runningRef: { current: true },
      runGenerationRef,
      runRef: { current: run },
      eventsRef: { current: { onLock } },
      grabFrame: () => FRAME,
      processFrame,
    }),
  );
  act(() => {
    hook.result.current.enqueue({ frame: FRAME, thumbnail: null }, 0);
  });
  return { hook, onLock, run, runGenerationRef };
}

function deferredOutcome() {
  let finish!: (result: FrameOutcome) => void;
  // oxlint-disable-next-line promise/avoid-new -- held open until the test finishes it
  const promise = new Promise<FrameOutcome>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

const STRONG = { key: "k-a", artKey: "art-a", score: 90, rivalScore: 0 };

describe("useScanCatchUp", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops a queued frame that verified nothing", async () => {
    const { hook, onLock } = mount(() => Promise.resolve(outcome(null)));

    await act(async () => {
      await hook.result.current.run();
    });

    expect(onLock).not.toHaveBeenCalled();
    expect(hook.result.current.pending).toEqual([]);
  });

  it("swallows a failed second look and frees the slot", async () => {
    const { hook, onLock } = mount(() => Promise.reject(new Error("worker gone")));
    act(() => {
      hook.result.current.enqueue({ frame: FRAME, thumbnail: null }, 1);
    });

    await act(async () => {
      await hook.result.current.run();
    });

    expect(onLock).not.toHaveBeenCalled();
    expect(hook.result.current.pending).toEqual([]);
    expect(hook.result.current.shouldRun(false, false)).toBe(true);
  });

  it("ignores a second look that finished after the run was stopped", async () => {
    const strong = { key: "k-a", artKey: "art-a", score: 90, rivalScore: 0 };
    let finish!: (result: FrameOutcome) => void;
    const { hook, onLock, runGenerationRef } = mount(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- held open until the run is stopped
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    let running!: Promise<void>;
    act(() => {
      running = hook.result.current.run();
    });
    runGenerationRef.current++;
    finish(outcome(strong));
    await act(async () => {
      await running;
    });

    expect(onLock).not.toHaveBeenCalled();
    expect(hook.result.current.pending).toEqual([]);
  });

  it("waits while a second look is already running", async () => {
    // oxlint-disable-next-line promise/avoid-new -- a second look that never finishes
    const { hook } = mount(() => new Promise(() => {}));
    act(() => {
      hook.result.current.enqueue({ frame: FRAME, thumbnail: null }, 1);
      void hook.result.current.run();
    });

    expect(hook.result.current.shouldRun(false, false)).toBe(false);
  });

  it("adds a strongly verified second look and holds the live pass off re-adding it", async () => {
    const { hook, onLock, run } = mount(() => Promise.resolve(outcome(STRONG)));

    await act(async () => {
      await hook.result.current.run();
    });

    expect(onLock).toHaveBeenCalledTimes(1);
    expect(onLock.mock.calls[0]![0]).toMatchObject({ key: "k-a", framesToLock: 1, score: 90 });
    expect(run.relock.allows("art-a")).toBe(false);
  });

  it("keeps the queue waiting while Identify runs, even after a queued second look finished", async () => {
    const queued = deferredOutcome();
    const identify = deferredOutcome();
    const looks = [queued.promise, identify.promise];
    const { hook } = mount(() => looks.shift() ?? Promise.resolve(outcome(null)));
    act(() => {
      hook.result.current.enqueue({ frame: FRAME, thumbnail: null }, 1);
    });

    let running!: Promise<void>;
    let identifying!: Promise<unknown>;
    act(() => {
      running = hook.result.current.run();
      identifying = hook.result.current.identifyNow();
    });
    queued.finish(outcome(null));
    await act(async () => {
      await running;
    });

    expect(hook.result.current.shouldRun(false, false)).toBe(false);

    identify.finish(outcome(null));
    await act(async () => {
      await identifying;
    });
    expect(hook.result.current.shouldRun(false, false)).toBe(true);
  });

  it("shares one look between two Identify taps, so the card is added once", async () => {
    const look = deferredOutcome();
    const processFrame = vi.fn(() => look.promise);
    const { hook, onLock } = mount(processFrame);

    let first!: Promise<IdentifyAttempt>;
    let second!: Promise<IdentifyAttempt>;
    act(() => {
      first = hook.result.current.identifyNow();
      second = hook.result.current.identifyNow();
    });
    look.finish(outcome(STRONG));
    let answers: IdentifyAttempt[] = [];
    await act(async () => {
      answers = await Promise.all([first, second]);
    });

    expect(processFrame).toHaveBeenCalledTimes(1);
    expect(onLock).toHaveBeenCalledTimes(1);
    expect(answers.map((answer) => answer.identified)).toEqual([true, true]);
  });

  it("starts Identify's look only once a running queued look finished", async () => {
    const queued = deferredOutcome();
    const looks = [queued.promise];
    const processFrame = vi.fn(() => looks.shift() ?? Promise.resolve(outcome(null)));
    const { hook } = mount(processFrame);

    let running!: Promise<void>;
    let identifying!: Promise<IdentifyAttempt>;
    act(() => {
      running = hook.result.current.run();
      identifying = hook.result.current.identifyNow();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(processFrame).toHaveBeenCalledTimes(1);

    queued.finish(outcome(null));
    await act(async () => {
      await Promise.all([running, identifying]);
    });
    expect(processFrame).toHaveBeenCalledTimes(2);
  });
});
