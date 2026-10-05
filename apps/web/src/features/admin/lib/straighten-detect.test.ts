import type { CardCandidate, Quad } from "@openrift/shared/scan/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectQuadInOriginal,
  detectionSize,
  pickCardOutline,
  quadToOriginal,
} from "./straighten-detect";

const { loadBoardDetector } = vi.hoisted(() => ({ loadBoardDetector: vi.fn() }));

vi.mock("onnxruntime-web/wasm", () => ({ env: { wasm: {} } }));
vi.mock("@/features/scan/lib/scan-ort-assets", () => ({ ORT_WASM_PATHS: { wasm: "ort.wasm" } }));
vi.mock("@/features/scan/lib/scan-detector", () => ({ loadBoardDetector }));

function rectQuad(x: number, y: number, width: number, height: number): Quad {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function outline(quad: Quad, score: number): CardCandidate {
  return { quad, areaFraction: 0.5, score };
}

describe("pickCardOutline", () => {
  it("returns null without outlines", () => {
    expect(pickCardOutline([], 1000, 1000)).toBeNull();
  });

  it("picks the most confident outline", () => {
    const weak = outline(rectQuad(0, 0, 400, 560), 0.5);
    const strong = outline(rectQuad(500, 100, 300, 420), 0.9);
    expect(pickCardOutline([weak, strong], 1000, 1000)).toBe(strong);
  });

  it("ignores outlines too small to be the photo's card", () => {
    const speck = outline(rectQuad(10, 10, 50, 70), 0.99);
    const card = outline(rectQuad(200, 100, 500, 700), 0.6);
    expect(pickCardOutline([speck, card], 1000, 1000)).toBe(card);
  });

  it("returns null when every outline is too small", () => {
    expect(pickCardOutline([outline(rectQuad(0, 0, 50, 70), 0.9)], 1000, 1000)).toBeNull();
  });

  it("breaks a confidence tie by the larger outline", () => {
    const smaller = outline(rectQuad(0, 0, 300, 420), 0.8);
    const larger = outline(rectQuad(400, 0, 500, 700), 0.8);
    expect(pickCardOutline([smaller, larger], 1000, 1000)).toBe(larger);
  });
});

describe("detectionSize", () => {
  it("keeps a photo within the limit at full size", () => {
    expect(detectionSize(1200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("scales a large photo to 1600 px on its long side", () => {
    expect(detectionSize(6000, 4000)).toEqual({ width: 1600, height: 1067 });
    expect(detectionSize(3000, 5000)).toEqual({ width: 960, height: 1600 });
  });
});

describe("quadToOriginal", () => {
  it("maps a quad found on the scaled photo back to original pixels per axis", () => {
    const quad = quadToOriginal(
      rectQuad(160, 100, 800, 534),
      { width: 1600, height: 1067 },
      { width: 6000, height: 4000 },
    );
    expect(quad[0].x).toBeCloseTo(600, 6);
    expect(quad[0].y).toBeCloseTo((100 * 4000) / 1067, 6);
    expect(quad[2].x).toBeCloseTo(3600, 6);
    expect(quad[2].y).toBeCloseTo((634 * 4000) / 1067, 6);
  });

  it("clamps mapped corners to the original image", () => {
    const quad = quadToOriginal(
      rectQuad(-10, 0, 1620, 1067),
      { width: 1600, height: 1067 },
      { width: 6000, height: 4000 },
    );
    expect(quad[0]).toEqual({ x: 0, y: 0 });
    expect(quad[2]).toEqual({ x: 6000, y: 4000 });
  });
});

describe("detectQuadInOriginal detector loading", () => {
  afterEach(() => {
    loadBoardDetector.mockReset();
    vi.unstubAllGlobals();
  });

  function stubOfflinePhoto(): void {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("photo offline")));
  }

  it("loads the detector again after a failed load", async () => {
    stubOfflinePhoto();
    loadBoardDetector.mockRejectedValueOnce(new Error("model missing"));
    loadBoardDetector.mockResolvedValueOnce(vi.fn());

    await expect(detectQuadInOriginal("retry.onnx", "photo.jpg")).rejects.toThrow("model missing");
    await expect(detectQuadInOriginal("retry.onnx", "photo.jpg")).rejects.toThrow("photo offline");

    expect(loadBoardDetector).toHaveBeenCalledTimes(2);
  });

  it("reuses a detector that loaded", async () => {
    stubOfflinePhoto();
    loadBoardDetector.mockResolvedValue(vi.fn());

    await expect(detectQuadInOriginal("reuse.onnx", "a.jpg")).rejects.toThrow("photo offline");
    await expect(detectQuadInOriginal("reuse.onnx", "b.jpg")).rejects.toThrow("photo offline");

    expect(loadBoardDetector).toHaveBeenCalledOnce();
  });

  it("loads a separate detector for another model", async () => {
    stubOfflinePhoto();
    loadBoardDetector.mockResolvedValue(vi.fn());

    await expect(detectQuadInOriginal("model-a.onnx", "a.jpg")).rejects.toThrow("photo offline");
    await expect(detectQuadInOriginal("model-b.onnx", "a.jpg")).rejects.toThrow("photo offline");

    expect(loadBoardDetector.mock.calls.map(([url]) => url)).toEqual([
      "model-a.onnx",
      "model-b.onnx",
    ]);
  });
});
