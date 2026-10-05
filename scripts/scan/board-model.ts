/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Runs the board detector (ONNX file from SCAN_BOARD_DETECTOR) under
 * onnxruntime-node, as the session's `detectBoard` hook.
 */
import * as ort from "onnxruntime-node";

import {
  BOARD_DETECTOR_SIZE,
  fillBoardDetectorInput,
  boardDetectorCandidates,
} from "../../packages/shared/src/scan/board-detector.js";
import type { CardCandidate, RgbaImage } from "../../packages/shared/src/scan/types.js";
import { outputData } from "./lib";

export function createBoardDetector(
  modelFile: string,
): (frame: RgbaImage) => Promise<CardCandidate[]> {
  const sessionPromise = ort.InferenceSession.create(modelFile);
  const input = new Float32Array(3 * BOARD_DETECTOR_SIZE * BOARD_DETECTOR_SIZE);
  return async (frame) => {
    const letterbox = fillBoardDetectorInput(frame, input);
    const session = await sessionPromise;
    const output = await session.run({
      image: new ort.Tensor("float32", input, [1, 3, BOARD_DETECTOR_SIZE, BOARD_DETECTOR_SIZE]),
    });
    return boardDetectorCandidates(
      frame,
      letterbox,
      outputData(output, "center", modelFile),
      outputData(output, "corner", modelFile),
      outputData(output, "offsets", modelFile),
    );
  };
}
