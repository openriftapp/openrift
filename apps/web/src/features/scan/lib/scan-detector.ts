import type { DetectCards } from "@openrift/shared/scan/ort-runners";
import { boardDetectorRunner, cardDetectorRunner } from "@openrift/shared/scan/ort-runners";

import { scanAssetError } from "@/features/scan/lib/scan-asset-hint";
import { fetchWithProgress } from "@/lib/fetch-progress";

/**
 * Call once onnxruntime-web is configured (wasm paths, threads): it reads that
 * setup on its first session.
 */
export async function loadCardDetector(modelUrl: string): Promise<DetectCards> {
  const ort = await import("onnxruntime-web/wasm");
  const session = await ort.InferenceSession.create(
    await fetchWithProgress(modelUrl, undefined, scanAssetError("the card detector", modelUrl)),
    { executionProviders: ["wasm"], graphOptimizationLevel: "basic" },
  );
  return cardDetectorRunner(session, ort.Tensor, "the card detector");
}

/** Same onnxruntime-web setup as `loadCardDetector`. */
export async function loadBoardDetector(modelUrl: string): Promise<DetectCards> {
  const ort = await import("onnxruntime-web/wasm");
  const session = await ort.InferenceSession.create(
    await fetchWithProgress(modelUrl, undefined, scanAssetError("the board detector", modelUrl)),
    { executionProviders: ["wasm"], graphOptimizationLevel: "basic" },
  );
  return boardDetectorRunner(session, ort.Tensor, "the board detector");
}
