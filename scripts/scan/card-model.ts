/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Runs the card detector (ONNX file from SCAN_DETECTOR)
 * under onnxruntime-node, as the session's `detectCard` hook.
 */
import * as ort from "onnxruntime-node";

import {
  CARD_DETECTOR_VIEW_HEIGHT,
  CARD_DETECTOR_VIEW_WIDTH,
  cardDetectorCandidates,
  fillCardDetectorInput,
} from "../../packages/shared/src/scan/card-detector.js";
import type { CardCandidate, RgbaImage } from "../../packages/shared/src/scan/types.js";
import { outputData } from "./lib";

export function createCardDetector(
  modelFile: string,
): (frame: RgbaImage) => Promise<CardCandidate[]> {
  const sessionPromise = ort.InferenceSession.create(modelFile);
  const input = new Float32Array(3 * CARD_DETECTOR_VIEW_WIDTH * CARD_DETECTOR_VIEW_HEIGHT);
  return async (frame) => {
    const window = fillCardDetectorInput(frame, input);
    const session = await sessionPromise;
    const output = await session.run({
      image: new ort.Tensor("float32", input, [
        1,
        3,
        CARD_DETECTOR_VIEW_HEIGHT,
        CARD_DETECTOR_VIEW_WIDTH,
      ]),
    });
    return cardDetectorCandidates(
      frame,
      window,
      outputData(output, "heat", modelFile),
      outputData(output, "present", modelFile)[0] ?? 0,
    );
  };
}
