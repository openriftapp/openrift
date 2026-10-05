import type { BoardCard } from "@openrift/shared/scan/board";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { CardCandidate } from "@openrift/shared/scan/types";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createScanRun } from "@/features/scan/lib/scan-run";

import { useScanBoard } from "./use-scan-board";

vi.mock("@/features/scan/lib/scan-frame-grab", () => ({
  grabRotatedFrame: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
}));

const FRAME = { width: 640, height: 480 };
const QUIET = { cardInGuide: false, settling: false, sweeping: false };

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

function renderBoard({ readBoard }: { readBoard: () => Promise<BoardCard[] | null> }) {
  const onBoardRead = vi.fn();
  const hook = renderHook(() =>
    useScanBoard({
      bank: null,
      videoRef: { current: document.createElement("video") },
      runGenerationRef: { current: 0 },
      runRef: { current: createScanRun("single") },
      eventsRef: { current: { onBoardRead } },
      readBoard,
    }),
  );
  return { hook, onBoardRead };
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

    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET);
    expect(readBoard).not.toHaveBeenCalled();
    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET);

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(onBoardRead).toHaveBeenCalledTimes(1);
  });

  it("ignores surveys while a card is being aimed", async () => {
    const readBoard = vi.fn(() => Promise.resolve([boardCard]));
    const { hook } = renderBoard({ readBoard });
    const aimed = { ...QUIET, cardInGuide: true };

    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, aimed);
    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, aimed);

    expect(readBoard).not.toHaveBeenCalled();
  });

  it("reports nothing when the engine has no worker to read with", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const readBoard = vi.fn(() => Promise.resolve(null));
    const { hook, onBoardRead } = renderBoard({ readBoard });

    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET);
    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET);

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(onBoardRead).not.toHaveBeenCalled();
  });

  it("keeps scanning when a board read fails", async () => {
    const readBoard = vi.fn(() => Promise.reject(new Error("the board detector would not load")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hook } = renderBoard({ readBoard });

    await hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET);
    await expect(
      hook.result.current.noteSurvey(twoCardsInGuide(), FRAME, QUIET),
    ).resolves.toBeUndefined();

    expect(readBoard).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});
