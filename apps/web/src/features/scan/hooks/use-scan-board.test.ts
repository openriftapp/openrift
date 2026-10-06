import type { BoardCard } from "@openrift/shared/scan/board";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { CardCandidate } from "@openrift/shared/scan/types";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { createScanLoop } from "@/features/scan/lib/scan-loop";
import { createScanRun } from "@/features/scan/lib/scan-run";

import { useScanBoard } from "./use-scan-board";

vi.mock("@/features/scan/lib/scan-frame-grab", () => ({
  grabRotatedFrame: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
}));

const FRAME = { width: 640, height: 480 };

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

function survey(): FrameOutcome {
  return { survey: twoCardsInGuide(), sweeping: false } as FrameOutcome;
}

function renderBoard({ readBoard }: { readBoard: () => Promise<BoardCard[] | null> }) {
  const onBoardRead = vi.fn();
  const run = createScanRun("single");
  const loop = createScanLoop<PendingFrame>({ run: () => run, idleGate: () => 0.5, readBoard });
  const hook = renderHook(() =>
    useScanBoard({
      bank: null,
      videoRef: { current: document.createElement("video") },
      runRef: { current: run },
      eventsRef: { current: { onBoardRead } },
      loop: () => loop,
    }),
  );
  return { hook, onBoardRead, run };
}

const boardCard = { key: "k-a", artKey: "art-a" } as BoardCard;

describe("useScanBoard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the board once two surveys in a row see several cards in the guide", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const readBoard = vi.fn(() => Promise.resolve([boardCard]));
    const { hook, onBoardRead } = renderBoard({ readBoard });

    await hook.result.current.noteSurvey(survey(), FRAME);
    expect(readBoard).not.toHaveBeenCalled();
    await hook.result.current.noteSurvey(survey(), FRAME);

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(onBoardRead).toHaveBeenCalledTimes(1);
  });

  it("ignores surveys while a card is being aimed", async () => {
    const readBoard = vi.fn(() => Promise.resolve([boardCard]));
    const { hook, run } = renderBoard({ readBoard });
    run.update({ cardInGuide: true });

    await hook.result.current.noteSurvey(survey(), FRAME);
    await hook.result.current.noteSurvey(survey(), FRAME);

    expect(readBoard).not.toHaveBeenCalled();
  });

  it("reports nothing when the engine has no worker to read with", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const readBoard = vi.fn(() => Promise.resolve(null));
    const { hook, onBoardRead } = renderBoard({ readBoard });

    await hook.result.current.noteSurvey(survey(), FRAME);
    await hook.result.current.noteSurvey(survey(), FRAME);

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(onBoardRead).not.toHaveBeenCalled();
  });

  it("keeps scanning when a board read fails", async () => {
    const readBoard = vi.fn(() => Promise.reject(new Error("the board detector would not load")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hook } = renderBoard({ readBoard });

    await hook.result.current.noteSurvey(survey(), FRAME);
    await expect(hook.result.current.noteSurvey(survey(), FRAME)).resolves.toBeNull();

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});
