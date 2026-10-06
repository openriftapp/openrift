import { toGray } from "@openrift/shared/scan/image";
import type { PlacementDetector } from "@openrift/shared/scan/placement";
import { createPlacementDetector } from "@openrift/shared/scan/placement";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef } from "react";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { guideRectIn, snapshotVideoRect } from "@/features/scan/lib/scan-flight";
import { grabWatchFrame } from "@/features/scan/lib/scan-frame-grab";
import type { ScanLoop } from "@/features/scan/lib/scan-loop";

export interface ScanPlacementsOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  runGenerationRef: RefObject<number>;
  loop: () => ScanLoop<PendingFrame>;
  grabFrame: (video: HTMLVideoElement) => RgbaImage | null;
  rearm: () => void;
  onMiss: (pending: PendingFrame, now: number) => void;
}

export interface ScanPlacements {
  begin: (generation: number) => void;
}

export function useScanPlacements(options: ScanPlacementsOptions): ScanPlacements {
  const { videoRef, runGenerationRef, loop } = options;
  const placementRef = useRef<PlacementDetector | null>(null);
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
    const { missedFrame, confirmed } = loop().observePlacement(signal, now, () => {
      const frame = options.grabFrame(video);
      return frame
        ? { frame, thumbnail: snapshotVideoRect(video, guideRectIn(video.getBoundingClientRect())) }
        : null;
    });
    if (missedFrame) {
      options.onMiss(missedFrame, now);
    }
    if (confirmed) {
      options.rearm();
    }
  }

  function begin(generation: number): void {
    placementRef.current = createPlacementDetector();
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
