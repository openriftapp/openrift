import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { detectOutlinesInPhoto } from "@openrift/shared/scan/board";
import { snapQuadToEdges } from "@openrift/shared/scan/edge-snap";
import { quadArea } from "@openrift/shared/scan/geometry";
import { toGray } from "@openrift/shared/scan/image";
import type { CardCandidate, Point, Quad, RgbaImage } from "@openrift/shared/scan/types";

import { clampQuad, orderQuadFromOrigin } from "@/features/admin/lib/straighten-quad";

type Detect = (image: RgbaImage) => Promise<CardCandidate[]>;

const MIN_AREA_FRACTION = 0.02;

/** Pixels. */
const DETECTION_MAX_SIDE = 1600;

let detectorCache: { url: string; detector: Promise<Detect> } | null = null;

export function pickCardOutline(
  outlines: readonly CardCandidate[],
  width: number,
  height: number,
): CardCandidate | null {
  const minArea = width * height * MIN_AREA_FRACTION;
  let best: CardCandidate | null = null;
  let bestArea = 0;
  for (const outline of outlines) {
    const area = quadArea(outline.quad);
    if (area < minArea) {
      continue;
    }
    if (
      best === null ||
      outline.score > best.score ||
      (outline.score === best.score && area > bestArea)
    ) {
      best = outline;
      bestArea = area;
    }
  }
  return best;
}

async function createDetector(modelUrl: string): Promise<Detect> {
  const [ort, { ORT_WASM_PATHS }, { loadBoardDetector }] = await Promise.all([
    import("onnxruntime-web/wasm"),
    import("@/features/scan/lib/scan-ort-assets"),
    import("@/features/scan/lib/scan-detector"),
  ]);
  if (ort.env.wasm.wasmPaths === undefined) {
    ort.env.wasm.wasmPaths = { wasm: ORT_WASM_PATHS.wasm };
    // Proxy and pthread workers load ort from its chunk URL; only the scan worker's setup is proven.
    ort.env.wasm.numThreads = 1;
  }
  return await loadBoardDetector(modelUrl);
}

async function boardDetector(modelUrl: string): Promise<Detect> {
  if (detectorCache?.url !== modelUrl) {
    detectorCache = { url: modelUrl, detector: createDetector(modelUrl) };
  }
  try {
    return await detectorCache.detector;
  } catch (error) {
    detectorCache = null;
    throw error;
  }
}

export function detectionSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, DETECTION_MAX_SIDE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function quadToOriginal(
  quad: Quad,
  detected: { width: number; height: number },
  original: { width: number; height: number },
): ImageQuad {
  const scaleX = original.width / detected.width;
  const scaleY = original.height / detected.height;
  const map = (point: Point): Point => ({ x: point.x * scaleX, y: point.y * scaleY });
  return clampQuad(
    [map(quad[0]), map(quad[1]), map(quad[2]), map(quad[3])],
    original.width,
    original.height,
  );
}

function drawPixels(bitmap: ImageBitmap): ImageData | null {
  // Safari returns no context for a canvas over ~16.7 MP.
  const size = detectionSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return null;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return context.getImageData(0, 0, size.width, size.height);
}

export async function detectQuadInOriginal(
  boardDetectorUrl: string,
  url: string,
): Promise<ImageQuad | null> {
  const detect = await boardDetector(boardDetectorUrl);
  const response = await fetch(url);
  // The server reports corners on the unrotated pixel grid.
  const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: "none" });
  const original = { width: bitmap.width, height: bitmap.height };
  const pixels = drawPixels(bitmap);
  bitmap.close();
  if (pixels === null) {
    return null;
  }

  const picked = pickCardOutline(
    await detectOutlinesInPhoto(pixels, detect),
    pixels.width,
    pixels.height,
  );
  if (picked === null) {
    return null;
  }
  const quad = snapQuadToEdges(toGray(pixels), picked.quad);
  return quadToOriginal(orderQuadFromOrigin(quad), pixels, original);
}
