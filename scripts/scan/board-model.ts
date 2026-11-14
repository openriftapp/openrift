/**
 * Runs the board detector (ONNX file from SCAN_BOARD_DETECTOR) under
 * onnxruntime-node, as the session's `detectBoard` hook.
 */
import * as ort from "onnxruntime-node";

import type { DetectCards } from "../../packages/shared/src/scan/ort-runners.js";
import { boardDetectorRunner } from "../../packages/shared/src/scan/ort-runners.js";

export function createBoardDetector(modelFile: string): DetectCards {
  return boardDetectorRunner(ort.InferenceSession.create(modelFile), ort.Tensor, modelFile);
}
