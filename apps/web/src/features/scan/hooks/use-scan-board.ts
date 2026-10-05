import type { BoardCard } from "@openrift/shared/scan/board";
import { cardsInGuide } from "@openrift/shared/scan/cards-in-guide";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef } from "react";

import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import { describeKey } from "@/features/scan/lib/scan-bank";
import {
  boardSurveyCounts,
  boardTriggerStart,
  freshBoardCards,
  noteBoardSurvey,
} from "@/features/scan/lib/scan-board-trigger";
import { LOCK_VIBRATION_MS } from "@/features/scan/lib/scan-feedback";
import { grabRotatedFrame } from "@/features/scan/lib/scan-frame-grab";
import type { ScannerEvents } from "@/features/scan/lib/scan-locks";
import { boardReadCards } from "@/features/scan/lib/scan-locks";
import type { ScanRun } from "@/features/scan/lib/scan-run";

export interface ScanBoardOptions {
  bank: ScanBankInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  runGenerationRef: RefObject<number>;
  runRef: RefObject<ScanRun>;
  eventsRef: RefObject<ScannerEvents | undefined>;
  readBoard: (still: RgbaImage) => Promise<BoardCard[] | null>;
}

interface BoardSurveyState {
  cardInGuide: boolean;
  settling: boolean;
  sweeping: boolean;
}

export interface ScanBoard {
  noteSurvey: (
    outlines: readonly CardCandidate[],
    frame: { width: number; height: number },
    state: BoardSurveyState,
  ) => Promise<void>;
  reset: () => void;
}

export function useScanBoard(options: ScanBoardOptions): ScanBoard {
  const { bank, videoRef, runGenerationRef, runRef, eventsRef } = options;
  const triggerRef = useRef(boardTriggerStart());
  const stillCanvasRef = useRef<HTMLCanvasElement | null>(null);

  function readDue(
    outlines: readonly CardCandidate[],
    frame: { width: number; height: number },
    state: BoardSurveyState,
  ): boolean {
    if (!boardSurveyCounts(state)) {
      return false;
    }
    const cards = cardsInGuide(outlines, centeredGuideQuad(frame.width, frame.height), frame);
    return noteBoardSurvey(triggerRef.current, cards.length, performance.now());
  }

  function grabStill(video: HTMLVideoElement): RgbaImage | null {
    if (!stillCanvasRef.current) {
      stillCanvasRef.current = document.createElement("canvas");
    }
    return grabRotatedFrame(
      video,
      stillCanvasRef.current,
      Math.max(video.videoWidth, video.videoHeight),
      runRef.current.rotation.turns(),
    );
  }

  async function readBoard(): Promise<void> {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const generation = runGenerationRef.current;
    const still = grabStill(video);
    if (!still) {
      return;
    }
    const startedAt = performance.now();
    const read = await options.readBoard(still);
    if (read === null || generation !== runGenerationRef.current) {
      return;
    }
    const run = runRef.current;
    const fresh = freshBoardCards(triggerRef.current, read).filter((card) =>
      run.relock.allows(card.artKey),
    );
    console.log(
      `[scan] BOARD read ${read.length} cards (${fresh.length} new) from ${still.width}x${still.height} in ${(performance.now() - startedAt).toFixed(0)}ms`,
    );
    if (fresh.length === 0) {
      return;
    }
    const labels = bank?.labels ?? {};
    const addedAt = performance.now();
    for (const card of fresh) {
      run.recentBoardAdds.note(card.artKey, addedAt);
      run.relock.note(card.artKey, addedAt);
    }
    navigator.vibrate?.(LOCK_VIBRATION_MS);
    eventsRef.current?.onBoardRead?.(boardReadCards(fresh, (key) => describeKey(labels, key)));
  }

  async function noteSurvey(
    outlines: readonly CardCandidate[],
    frame: { width: number; height: number },
    state: BoardSurveyState,
  ): Promise<void> {
    if (!readDue(outlines, frame, state)) {
      return;
    }
    try {
      await readBoard();
    } catch (error) {
      console.warn("[scan] board read failed", error);
    }
  }

  function reset(): void {
    triggerRef.current = boardTriggerStart();
  }

  return { noteSurvey, reset };
}
