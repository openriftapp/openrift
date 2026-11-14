/**
 * Runs the card detector (ONNX file from SCAN_DETECTOR)
 * under onnxruntime-node, as the session's `detectCard` hook.
 */
import * as ort from "onnxruntime-node";

import type { DetectCards } from "../../packages/shared/src/scan/ort-runners.js";
import { cardDetectorRunner } from "../../packages/shared/src/scan/ort-runners.js";

export function createCardDetector(modelFile: string): DetectCards {
  return cardDetectorRunner(ort.InferenceSession.create(modelFile), ort.Tensor, modelFile);
}
