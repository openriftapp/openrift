import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef } from "react";

import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import { describeKey } from "@/features/scan/lib/scan-bank";
import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { LOCK_VIBRATION_MS } from "@/features/scan/lib/scan-feedback";
import { grabRotatedFrame } from "@/features/scan/lib/scan-frame-grab";
import type { ScannerEvents } from "@/features/scan/lib/scan-locks";
import { boardReadCards } from "@/features/scan/lib/scan-locks";
import type { BoardReadResult, ScanLoop } from "@/features/scan/lib/scan-loop";
import type { ScanRun } from "@/features/scan/lib/scan-run";

export interface ScanBoardOptions {
  bank: ScanBankInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  runRef: RefObject<ScanRun>;
  eventsRef: RefObject<ScannerEvents | undefined>;
  loop: () => ScanLoop<PendingFrame>;
}

export interface ScanBoard {
  noteSurvey: (
    outcome: FrameOutcome,
    frame: { width: number; height: number },
  ) => Promise<BoardReadResult | null>;
}

export function useScanBoard(options: ScanBoardOptions): ScanBoard {
  const { bank, videoRef, runRef, eventsRef, loop } = options;
  const stillCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  async function readBoard(): Promise<BoardReadResult | null> {
    const video = videoRef.current;
    const still = video ? grabStill(video) : null;
    if (!still) {
      return null;
    }
    const startedAt = performance.now();
    const result = await loop().readBoard(still, () => performance.now());
    if (!result) {
      return null;
    }
    const { read, fresh } = result;
    console.log(
      `[scan] BOARD read ${read.length} cards (${fresh.length} new) from ${still.width}x${still.height} in ${(performance.now() - startedAt).toFixed(0)}ms`,
    );
    if (fresh.length > 0) {
      const labels = bank?.labels ?? {};
      navigator.vibrate?.(LOCK_VIBRATION_MS);
      eventsRef.current?.onBoardRead?.(boardReadCards(fresh, (key) => describeKey(labels, key)));
    }
    return result;
  }

  async function noteSurvey(
    outcome: FrameOutcome,
    frame: { width: number; height: number },
  ): Promise<BoardReadResult | null> {
    if (!loop().boardReadDue(outcome, frame, performance.now())) {
      return null;
    }
    try {
      return await readBoard();
    } catch (error) {
      console.warn("[scan] board read failed", error);
      return null;
    }
  }

  return { noteSurvey };
}
