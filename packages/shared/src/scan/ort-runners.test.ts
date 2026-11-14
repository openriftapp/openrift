import { describe, expect, it } from "vitest";

import type { OrtSessionLike } from "./ort-runners";
import { cardDetectorRunner, encoderRunner, outputData } from "./ort-runners";
import type { RgbaImage } from "./types";

class FakeTensor {
  readonly data: Float32Array;
  readonly dims: number[];
  constructor(_type: "float32", data: Float32Array, dims: number[]) {
    this.data = data;
    this.dims = dims;
  }
}

describe("outputData", () => {
  it("returns a float output", () => {
    const data = new Float32Array([1, 2]);
    expect(outputData({ heat: { data } }, "heat", "model.onnx")).toBe(data);
  });

  it("names the model and the output that is missing", () => {
    expect(() => outputData({}, "heat", "model.onnx")).toThrow(
      'model.onnx returned no "heat" output',
    );
  });
});

describe("encoderRunner", () => {
  it("hands the runtime a trimmed copy of the staging buffer", async () => {
    const feeds: FakeTensor[] = [];
    const session: OrtSessionLike<FakeTensor> = {
      run: async (input) => {
        feeds.push(input.pixel_values as FakeTensor);
        return { image_embeds: { data: new Float32Array([0.5]) } };
      },
    };
    const staging = new Float32Array(2 * 3 * 2 * 2).fill(1);
    const embed = encoderRunner(Promise.resolve(session), FakeTensor, "encoder.onnx", 2);

    const out = await embed(staging, 1);

    expect(out).toEqual(new Float32Array([0.5]));
    expect(feeds[0]?.dims).toEqual([1, 3, 2, 2]);
    expect(feeds[0]?.data.length).toBe(12);
    expect(feeds[0]?.data.buffer).not.toBe(staging.buffer);
  });

  it("rejects when the model has no image_embeds output", async () => {
    const session: OrtSessionLike<FakeTensor> = { run: async () => ({}) };
    const embed = encoderRunner(session, FakeTensor, "encoder.onnx", 2);

    await expect(embed(new Float32Array(12), 1)).rejects.toThrow(
      'encoder.onnx returned no "image_embeds" output',
    );
  });
});

describe("cardDetectorRunner", () => {
  function flatFrame(value: number): RgbaImage {
    return { data: new Uint8ClampedArray(64 * 64 * 4).fill(value), width: 64, height: 64 };
  }

  it("runs each of two overlapping calls on its own pixels", async () => {
    const seen: number[] = [];
    const session: OrtSessionLike<FakeTensor> = {
      run: async (input) => {
        seen.push((input.image as FakeTensor).data[0] ?? -1);
        return { heat: { data: new Float32Array(1) }, present: { data: new Float32Array([0]) } };
      },
    };
    let open = (_session: OrtSessionLike<FakeTensor>) => {};
    const pending = new Promise<OrtSessionLike<FakeTensor>>((resolve) => {
      open = resolve;
    });
    const detect = cardDetectorRunner(pending, FakeTensor, "detector.onnx");

    const dark = detect(flatFrame(51));
    const bright = detect(flatFrame(204));
    open(session);
    await Promise.all([dark, bright]);

    expect(seen.map((value) => value.toFixed(2))).toEqual(["0.20", "0.80"]);
  });
});
