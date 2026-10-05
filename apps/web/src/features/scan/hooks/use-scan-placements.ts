import { toGray } from "@openrift/shared/scan/image";
import type { PlacementDetector, PlacementHold } from "@openrift/shared/scan/placement";
import { createPlacementDetector, createPlacementHold } from "@openrift/shared/scan/placement";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef } from "react";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { guideRectIn, snapshotVideoRect } from "@/features/scan/lib/scan-flight";
import { grabWatchFrame } from "@/features/scan/lib/scan-frame-grab";
import type { ScanRun } from "@/features/scan/lib/scan-run";

export interface ScanPlacementsOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  runGenerationRef: RefObject<number>;
  runRef: RefObject<ScanRun>;
  grabFrame: (video: HTMLVideoElement) => RgbaImage | null;
  rearm: () => void;
  onMiss: (pending: PendingFrame, now: number) => void;
}

export interface ScanPlacements {
  begin: (generation: number) => void;
}

export function useScanPlacements(options: ScanPlacementsOptions): ScanPlacements {
  const { videoRef, runGenerationRef, runRef } = options;
  const placementRef = useRef<PlacementDetector | null>(null);
  const holdRef = useRef<PlacementHold>(createPlacementHold());
  const settleRef = useRef<{ at: number; pending: PendingFrame | null } | null>(null);
  const watchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  function watchPlacement(video: HTMLVideoElement, now: number): void {
    const detector = placementRef.current;
    if (!detector) {
      return;
    }
    // Written long-hand: the React Compiler cannot lower `??=`.
    if (!watchCanvasRef.current) {
      watchCanvasRef.current = document.createElement("canvas");
    }
    const pixels = grabWatchFrame(video, watchCanvasRef.current);
    if (!pixels) {
      return;
    }
    // Runs in the camera's own frame; rotation compensation doesn't apply
    // since the detector only compares consecutive frames.
    const signal = detector.observe(toGray(pixels), centeredGuideQuad(pixels.width, pixels.height));
    const run = runRef.current;
    // Must update now, not when the next card arrives, or the session's
    // last card goes uncounted.
    run.update({ settling: { disturbed: signal.disturbed, at: now } });
    if ((run.mode === "single" && !run.still) || run.sweeping) {
      holdRef.current = createPlacementHold();
      settleRef.current = null;
      return;
    }
    if (run.tally.takeMiss(now)) {
      const pending = run.pendingFrame;
      run.update({ pendingFrame: null });
      if (pending) {
        options.onMiss(pending, now);
      }
    }
    if (signal.placed) {
      const frame = options.grabFrame(video);
      settleRef.current = {
        at: now,
        pending: frame
          ? {
              frame,
              thumbnail: snapshotVideoRect(video, guideRectIn(video.getBoundingClientRect())),
            }
          : null,
      };
    }
    const settle = settleRef.current;
    const confirmed =
      run.mode === "capture" ? signal.placed : holdRef.current.observe(signal, now / 1000);
    // A lock during the hold already answered this placement.
    if (!confirmed || !settle || run.pile.lockedSince(settle.at)) {
      return;
    }
    settleRef.current = null;
    run.tally.notePlacement(now);
    run.pile.notePlacement();
    run.update({ pendingFrame: settle.pending });
    options.rearm();
  }

  function begin(generation: number): void {
    placementRef.current = createPlacementDetector();
    holdRef.current = createPlacementHold();
    settleRef.current = null;
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const watched = video;
    // Both schedulers hand the callback a performance.now() timestamp, so
    // the watcher is clocked on the frame it's looking at, not on delay.
    const watch = (frameTime: number) => {
      if (generation !== runGenerationRef.current) {
        return;
      }
      watchPlacement(watched, frameTime);
      if (watched.requestVideoFrameCallback) {
        watched.requestVideoFrameCallback(watch);
      } else {
        requestAnimationFrame(watch);
      }
    };
    if (watched.requestVideoFrameCallback) {
      watched.requestVideoFrameCallback(watch);
    } else {
      requestAnimationFrame(watch);
    }
  }

  return { begin };
}
