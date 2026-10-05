/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { ClipTruth, SavedRun } from "../../packages/shared/src/scan/bench-score.js";
import type { RgbaImage } from "../../packages/shared/src/scan/types.js";

export const REPO_ROOT = path.resolve(import.meta.dir, "../..");
export const MEDIA_CARDS = path.join(REPO_ROOT, "media/cards");
export const DATA_DIR = path.join(REPO_ROOT, "data/image-recognition-test");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const CLIPS = path.join(DATA_DIR, "clips/full");
export const DEFAULT_FPS = 30;

export function listClips(): string[] {
  if (!fs.existsSync(CLIPS)) {
    return [];
  }
  return fs
    .readdirSync(CLIPS)
    .filter((name) => fs.statSync(path.join(CLIPS, name)).isDirectory())
    .toSorted();
}

export function outputData(
  outputs: Record<string, { data: unknown } | undefined>,
  name: string,
  modelFile: string,
): Float32Array {
  const data = outputs[name]?.data;
  if (!(data instanceof Float32Array)) {
    throw new Error(`${modelFile} returned no "${name}" output`);
  }
  return data;
}

export function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Exits with status 2 when the value is not a positive integer. */
export function positiveIntArg(name: string): number | undefined {
  const raw = argValue(name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    process.stderr.write(`${name} ${raw}: expected a positive integer\n`);
    process.exit(2);
  }
  return value;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

export const TRUTH_DIR = path.join(DATA_DIR, "truth");
export const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");

/** Frames under `clips/full` cache the archived recording. A plain decode reproduces them byte for byte. */
export function extractClipFrames(clip: string): number {
  const outDir = path.join(CLIPS, clip);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      path.join(RECORDINGS_DIR, `${clip}.mp4`),
      "-q:v",
      "2",
      path.join(outDir, "%04d.jpg"),
    ],
    { stdio: "inherit" },
  );
  return fs.readdirSync(outDir).filter((file) => file.endsWith(".jpg")).length;
}

export function loadClipTruth(clip: string): ClipTruth | null {
  const file = path.join(TRUTH_DIR, `${clip}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as ClipTruth) : null;
}

/** A saved run, with 0 for the marker counters older runs lack. */
export function loadRun(file: string): SavedRun {
  const run = JSON.parse(fs.readFileSync(file, "utf-8")) as SavedRun;
  for (const clip of run.clips) {
    clip.score.markerOnly ??= 0;
    if (clip.app) {
      clip.app.markerMiss ??= 0;
    }
  }
  return run;
}

export async function loadImage(
  file: string,
  options: { maxSide?: number; rotate?: boolean } = {},
): Promise<RgbaImage> {
  let pipeline = sharp(file);
  if (options.rotate) {
    pipeline = pipeline.rotate();
  }
  pipeline = pipeline.flatten({ background: { r: 128, g: 128, b: 128 } });
  if (options.maxSide) {
    pipeline = pipeline.resize({
      width: options.maxSide,
      height: options.maxSide,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const { data, info } = await pipeline.raw().toColourspace("srgb").ensureAlpha().toBuffer({
    resolveWithObject: true,
  });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

export interface ReferenceImage {
  key: string;
  file: string;
}

// The disk tree also holds orphaned files (hand-added scans, superseded
// uploads) that no printing references; skip anything not in the catalogue.
export function listReferenceImages(): ReferenceImage[] {
  const catalogFile = path.join(CACHE_DIR, "catalog.json");
  if (!fs.existsSync(catalogFile)) {
    throw new Error(
      "catalog cache missing; import loadCatalog from ./catalog and call it once to build it",
    );
  }
  const known = new Set(
    (JSON.parse(fs.readFileSync(catalogFile, "utf-8")) as { key: string }[]).map((c) => c.key),
  );
  const out: ReferenceImage[] = [];
  for (const dir of fs.readdirSync(MEDIA_CARDS)) {
    const full = path.join(MEDIA_CARDS, dir);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    for (const file of fs.readdirSync(full)) {
      if (!file.endsWith("-400w.webp")) {
        continue;
      }
      const key = file.slice(0, -"-400w.webp".length);
      if (!known.has(key)) {
        continue;
      }
      out.push({ key, file: path.join(full, file) });
    }
  }
  return out.toSorted((a, b) => a.key.localeCompare(b.key));
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length });
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) {
        return;
      }
      out[i] = await fn(items[i], i);
      done++;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}
