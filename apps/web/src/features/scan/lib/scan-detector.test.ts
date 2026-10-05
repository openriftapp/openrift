import type { RgbaImage } from "@openrift/shared/scan/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadBoardDetector, loadCardDetector } from "./scan-detector";

let outputs: Record<string, { data: Float32Array }> = {};

vi.mock("onnxruntime-web/wasm", () => ({
  Tensor: vi.fn(),
  InferenceSession: {
    create: () => Promise.resolve({ run: () => Promise.resolve(outputs) }),
  },
}));
vi.mock("@/lib/fetch-progress", () => ({
  fetchWithProgress: () => Promise.resolve(new ArrayBuffer(8)),
}));

const MODEL_URL = "/media/scan/detector.onnx";

function frame(): RgbaImage {
  return { data: new Uint8ClampedArray(64 * 48 * 4), width: 64, height: 48 };
}

function zeros(): { data: Float32Array } {
  return { data: new Float32Array(1 << 16) };
}

beforeEach(() => {
  outputs = {};
});

describe("loadCardDetector", () => {
  it("finds no card when the model reports none present", async () => {
    outputs = { present: { data: new Float32Array([0]) }, heat: zeros() };
    const detect = await loadCardDetector(MODEL_URL);
    await expect(detect(frame())).resolves.toEqual([]);
  });

  it("names the heat map when the model omits it", async () => {
    outputs = { present: { data: new Float32Array([0]) } };
    const detect = await loadCardDetector(MODEL_URL);
    await expect(detect(frame())).rejects.toThrow('no "heat" output');
  });

  it("names the presence score when the model omits it", async () => {
    outputs = { heat: zeros() };
    const detect = await loadCardDetector(MODEL_URL);
    await expect(detect(frame())).rejects.toThrow('no "present" output');
  });
});

describe("loadBoardDetector", () => {
  it("finds no cards in empty heat maps", async () => {
    outputs = { center: zeros(), corner: zeros(), offsets: zeros() };
    const detect = await loadBoardDetector(MODEL_URL);
    await expect(detect(frame())).resolves.toEqual([]);
  });

  it("names the offsets when the model omits them", async () => {
    outputs = { center: zeros(), corner: zeros() };
    const detect = await loadBoardDetector(MODEL_URL);
    await expect(detect(frame())).rejects.toThrow('no "offsets" output');
  });
});
