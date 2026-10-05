import {
  BOARD_DETECTOR_SIZE,
  fillBoardDetectorInput,
  boardDetectorCandidates,
} from "@openrift/shared/scan/board-detector";
import {
  CARD_DETECTOR_VIEW_HEIGHT,
  CARD_DETECTOR_VIEW_WIDTH,
  cardDetectorCandidates,
  fillCardDetectorInput,
} from "@openrift/shared/scan/card-detector";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";

import { scanAssetError } from "@/features/scan/lib/scan-asset-hint";
import { fetchWithProgress } from "@/lib/fetch-progress";

export type DetectCards = (frame: RgbaImage) => Promise<CardCandidate[]>;

type DetectorOutputs = Record<string, { data: unknown } | undefined>;

function outputData(outputs: DetectorOutputs, name: string): Float32Array {
  const data = outputs[name]?.data;
  if (!(data instanceof Float32Array)) {
    throw new Error(`the detector model returned no "${name}" output`);
  }
  return data;
}

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
  const input = new Float32Array(3 * CARD_DETECTOR_VIEW_WIDTH * CARD_DETECTOR_VIEW_HEIGHT);
  return async (frame) => {
    const window = fillCardDetectorInput(frame, input);
    const output = await session.run({
      image: new ort.Tensor("float32", input, [
        1,
        3,
        CARD_DETECTOR_VIEW_HEIGHT,
        CARD_DETECTOR_VIEW_WIDTH,
      ]),
    });
    const present = outputData(output, "present")[0] ?? 0;
    return cardDetectorCandidates(frame, window, outputData(output, "heat"), present);
  };
}

/** Same onnxruntime-web setup as `loadCardDetector`. */
export async function loadBoardDetector(modelUrl: string): Promise<DetectCards> {
  const ort = await import("onnxruntime-web/wasm");
  const session = await ort.InferenceSession.create(
    await fetchWithProgress(modelUrl, undefined, scanAssetError("the board detector", modelUrl)),
    { executionProviders: ["wasm"], graphOptimizationLevel: "basic" },
  );
  const input = new Float32Array(3 * BOARD_DETECTOR_SIZE * BOARD_DETECTOR_SIZE);
  return async (frame) => {
    const letterbox = fillBoardDetectorInput(frame, input);
    const output = await session.run({
      image: new ort.Tensor("float32", input, [1, 3, BOARD_DETECTOR_SIZE, BOARD_DETECTOR_SIZE]),
    });
    return boardDetectorCandidates(
      frame,
      letterbox,
      outputData(output, "center"),
      outputData(output, "corner"),
      outputData(output, "offsets"),
    );
  };
}
