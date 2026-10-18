import type { BoardCard } from "@openrift/shared/scan/board";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { createScanLoop } from "@/features/scan/lib/scan-loop";
import { createScanRun } from "@/features/scan/lib/scan-run";

import { useScanBoard } from "./use-scan-board";

vi.mock("@/features/scan/lib/scan-frame-grab", () => ({
  grabRotatedFrame: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
}));

function renderBoard(readBoard: () => Promise<BoardCard[] | null>) {
  const onBoardRead = vi.fn();
  const run = createScanRun("capture");
  const loop = createScanLoop<PendingFrame>({ run: () => run, idleGate: () => 0.5, readBoard });
  const hook = renderHook(() =>
    useScanBoard({
      bank: null,
      videoRef: { current: document.createElement("video") },
      runRef: { current: run },
      eventsRef: { current: { onBoardRead } },
      loop: () => loop,
      zoom: () => 1,
    }),
  );
  return { hook, onBoardRead };
}

const boardCard = { key: "k-a", artKey: "art-a" } as BoardCard;

describe("useScanBoard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports every card a tap reads", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const readBoard = vi.fn(() => Promise.resolve([boardCard, boardCard]));
    const { hook, onBoardRead } = renderBoard(readBoard);

    await expect(hook.result.current.readTap()).resolves.toBe(true);

    expect(onBoardRead).toHaveBeenCalledTimes(1);
    expect(onBoardRead.mock.calls[0]![0]).toHaveLength(2);
  });

  it("reports nothing and says so when the tap reads no card", async () => {
    const { hook, onBoardRead } = renderBoard(() => Promise.resolve([]));

    await expect(hook.result.current.readTap()).resolves.toBe(false);

    expect(onBoardRead).not.toHaveBeenCalled();
  });

  it("reports nothing when the engine has no worker to read with", async () => {
    const { hook, onBoardRead } = renderBoard(() => Promise.resolve(null));

    await expect(hook.result.current.readTap()).resolves.toBe(false);

    expect(onBoardRead).not.toHaveBeenCalled();
  });

  it("treats a failed read as a tap that read no card", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hook } = renderBoard(() =>
      Promise.reject(new Error("the board detector would not load")),
    );

    await expect(hook.result.current.readTap()).resolves.toBe(false);

    expect(warn).toHaveBeenCalledOnce();
  });
});
