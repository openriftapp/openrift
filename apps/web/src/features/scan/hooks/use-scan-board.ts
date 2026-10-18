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
import type { ScanLoop } from "@/features/scan/lib/scan-loop";
import type { ScanRun } from "@/features/scan/lib/scan-run";

export interface ScanBoardOptions {
  bank: ScanBankInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  runRef: RefObject<ScanRun>;
  eventsRef: RefObject<ScannerEvents | undefined>;
  loop: () => ScanLoop<PendingFrame>;
  zoom: () => number;
}

export interface ScanBoard {
  readTap: () => Promise<boolean>;
}

export function useScanBoard(options: ScanBoardOptions): ScanBoard {
  const { bank, videoRef, runRef, eventsRef, loop, zoom } = options;
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
      zoom(),
    );
  }

  async function readTap(): Promise<boolean> {
    const video = videoRef.current;
    const still = video ? grabStill(video) : null;
    if (!still) {
      return false;
    }
    const startedAt = performance.now();
    let read: Awaited<ReturnType<ScanLoop<PendingFrame>["readBoard"]>> = null;
    try {
      read = await loop().readBoard(still, () => performance.now());
    } catch (error) {
      console.warn("[scan] board read failed", error);
    }
    if (!read || read.length === 0) {
      return false;
    }
    console.log(
      `[scan] BOARD read ${read.length} cards from ${still.width}x${still.height} in ${(performance.now() - startedAt).toFixed(0)}ms`,
    );
    const labels = bank?.labels ?? {};
    navigator.vibrate?.(LOCK_VIBRATION_MS);
    eventsRef.current?.onBoardRead?.(boardReadCards(read, (key) => describeKey(labels, key)));
    return true;
  }

  return { readTap };
}
