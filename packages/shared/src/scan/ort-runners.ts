/**
 * Model calls shared by the browser worker, the API bank build and the bench.
 * Callers create their own onnxruntime session (each keeps its own session
 * options) and pass it in with that runtime's `Tensor` class.
 */
import {
  BOARD_DETECTOR_SIZE,
  boardDetectorCandidates,
  fillBoardDetectorInput,
} from "./board-detector";
import {
  CARD_DETECTOR_VIEW_HEIGHT,
  CARD_DETECTOR_VIEW_WIDTH,
  cardDetectorCandidates,
  fillCardDetectorInput,
} from "./card-detector";
import type { CardEmbedder } from "./embed";
import type { CardCandidate, RgbaImage } from "./types";

export type OrtTensorClass<T> = new (type: "float32", data: Float32Array, dims: number[]) => T;

export interface OrtSessionLike<T> {
  run: (feeds: Record<string, T>) => Promise<Record<string, { data: unknown } | undefined>>;
}

type Session<T> = OrtSessionLike<T> | Promise<OrtSessionLike<T>>;

export type DetectCards = (frame: RgbaImage) => Promise<CardCandidate[]>;

export function outputData(
  outputs: Record<string, { data: unknown } | undefined>,
  name: string,
  model: string,
): Float32Array {
  const data = outputs[name]?.data;
  if (!(data instanceof Float32Array)) {
    throw new TypeError(`${model} returned no "${name}" output`);
  }
  return data;
}

export function cardDetectorRunner<T>(
  session: Session<T>,
  Tensor: OrtTensorClass<T>,
  model: string,
): DetectCards {
  const input = new Float32Array(3 * CARD_DETECTOR_VIEW_WIDTH * CARD_DETECTOR_VIEW_HEIGHT);
  return async (frame) => {
    const ready = await session;
    // Fill and run stay in one synchronous step: concurrent calls share `input`.
    const window = fillCardDetectorInput(frame, input);
    const output = await ready.run({
      image: new Tensor("float32", input, [
        1,
        3,
        CARD_DETECTOR_VIEW_HEIGHT,
        CARD_DETECTOR_VIEW_WIDTH,
      ]),
    });
    return cardDetectorCandidates(
      frame,
      window,
      outputData(output, "heat", model),
      outputData(output, "present", model)[0] ?? 0,
    );
  };
}

export function boardDetectorRunner<T>(
  session: Session<T>,
  Tensor: OrtTensorClass<T>,
  model: string,
): DetectCards {
  const input = new Float32Array(3 * BOARD_DETECTOR_SIZE * BOARD_DETECTOR_SIZE);
  return async (frame) => {
    const ready = await session;
    // Fill and run stay in one synchronous step: concurrent calls share `input`.
    const letterbox = fillBoardDetectorInput(frame, input);
    const output = await ready.run({
      image: new Tensor("float32", input, [1, 3, BOARD_DETECTOR_SIZE, BOARD_DETECTOR_SIZE]),
    });
    return boardDetectorCandidates(
      frame,
      letterbox,
      outputData(output, "center", model),
      outputData(output, "corner", model),
      outputData(output, "offsets", model),
    );
  };
}

/** The staging buffer is copied: a proxied runtime transfers the tensor's buffer. */
export function encoderRunner<T>(
  session: Session<T>,
  Tensor: OrtTensorClass<T>,
  model: string,
  imageSize: number,
): CardEmbedder {
  return async (pixels, count) => {
    const ready = await session;
    const output = await ready.run({
      pixel_values: new Tensor("float32", pixels.slice(0, count * 3 * imageSize * imageSize), [
        count,
        3,
        imageSize,
        imageSize,
      ]),
    });
    return outputData(output, "image_embeds", model);
  };
}
