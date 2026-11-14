import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import * as ort from "onnxruntime-node";

/**
 * Bun-side adapter for the shared embedding module (packages/shared/src/scan):
 * opens the encoder the API serves (or SCAN_ENCODER) under onnxruntime-node
 * and caches the reference bank on disk.
 */
import { chunk } from "../../packages/shared/src/collections.js";
import type { CardEmbedder, EmbedBank } from "../../packages/shared/src/scan/embed.js";
import {
  DEFAULT_SCAN_ENCODER_FILE,
  EMBED_IMAGE_SIZE,
  embedImageSizeOf,
  normalizeEmbeddings,
  preprocessCardInto,
} from "../../packages/shared/src/scan/embed.js";
import { toCanonicalFrame } from "../../packages/shared/src/scan/image.js";
import { encoderRunner } from "../../packages/shared/src/scan/ort-runners.js";
import type { ReferenceImage } from "./lib";
import { CACHE_DIR, listReferenceImages, loadImage, mapConcurrent, servedModel } from "./lib";

export const MODEL_FILE = servedModel(
  "SCAN_ENCODER",
  "SCAN_ENCODER_FILE",
  DEFAULT_SCAN_ENCODER_FILE,
);
const MODEL_TAG = `-${path.basename(MODEL_FILE, ".onnx")}`;
export const CANONICAL_BANK = process.env.SCAN_CANONICAL_BANK !== "0";

const BUILD_BATCH = 8;

/** Named after the reference keys too, so a catalogue change can never reuse an older bank. */
function cacheFile(refs: readonly ReferenceImage[], size: number, extension: string): string {
  const sizeTag = size === EMBED_IMAGE_SIZE ? "" : `-${size}`;
  const canonTag = CANONICAL_BANK ? "-canon" : "";
  const refsTag = createHash("sha256")
    .update(refs.map((ref) => ref.key).join(","))
    .digest("hex")
    .slice(0, 12);
  return path.join(
    CACHE_DIR,
    `embed-bank-card${MODEL_TAG}${sizeTag}${canonTag}-${refsTag}-v1.${extension}`,
  );
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function encoder(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    if (!fs.existsSync(MODEL_FILE)) {
      throw new Error(`missing ${MODEL_FILE}; set SCAN_ENCODER to an encoder ONNX file`);
    }
    sessionPromise = ort.InferenceSession.create(MODEL_FILE);
  }
  return sessionPromise;
}

async function modelImageSize(): Promise<number> {
  const session = await encoder();
  const input = session.inputMetadata[0];
  return embedImageSizeOf(input?.isTensor ? input.shape : undefined);
}

let sizePromise: Promise<number> | null = null;

export function embedSize(): Promise<number> {
  sizePromise ??= process.env.SCAN_EMBED_SIZE
    ? Promise.resolve(Number(process.env.SCAN_EMBED_SIZE))
    : modelImageSize();
  return sizePromise;
}

export const nodeEmbedder: CardEmbedder = async (pixels, count) =>
  await encoderRunner(encoder(), ort.Tensor, MODEL_FILE, await embedSize())(pixels, count);

export async function loadEmbedBank(force = false): Promise<EmbedBank> {
  const refs = listReferenceImages();
  const size = await embedSize();
  const meta = cacheFile(refs, size, "json");
  const binary = cacheFile(refs, size, "bin");
  if (!force && fs.existsSync(meta) && fs.existsSync(binary)) {
    const parsed = JSON.parse(fs.readFileSync(meta, "utf-8")) as { keys: string[]; dim: number };
    const raw = fs.readFileSync(binary);
    const vectors = new Float32Array(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    );
    if (vectors.length === parsed.keys.length * parsed.dim) {
      return { keys: parsed.keys, vectors };
    }
  }

  const chunks: Float32Array[][] = [];
  const input = new Float32Array(BUILD_BATCH * 3 * size * size);
  for (const batch of chunk(refs, BUILD_BATCH)) {
    const images = await mapConcurrent(batch, 4, (ref) => loadImage(ref.file));
    for (const [slot, image] of images.entries()) {
      preprocessCardInto(CANONICAL_BANK ? toCanonicalFrame(image) : image, input, slot, size);
    }
    chunks.push(normalizeEmbeddings(await nodeEmbedder(input, batch.length), batch.length));
  }
  const flat = chunks.flat();
  const dim = flat[0]?.length;
  if (dim === undefined) {
    throw new Error("no reference images to embed; the embedding bank would be empty");
  }
  const vectors = new Float32Array(refs.length * dim);
  for (const [i, vector] of flat.entries()) {
    vectors.set(vector, i * dim);
  }

  const keys = refs.map((ref) => ref.key);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(meta, JSON.stringify({ keys, dim }));
  fs.writeFileSync(binary, Buffer.from(vectors.buffer, 0, vectors.byteLength));
  return { keys, vectors };
}
