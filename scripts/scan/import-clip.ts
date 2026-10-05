/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Archives an /admin/scan recording as a bench clip (848 px, 30 fps), extracts its frames
 * and drafts a truth file from the phone's locks. A reviewed truth file is never overwritten.
 * Usage: bun scripts/scan/import-clip.ts <video> --name <clip> --split tune|holdout [--mode single|sweep] [--meta file] [--negative] [--force]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ClipMeta } from "../../apps/web/src/features/admin/lib/scan-recorder";
import type { ClipTruth, TruthCard } from "../../packages/shared/src/scan/bench-score.js";
import { loadCatalog } from "./catalog";
import {
  DEFAULT_FPS,
  RECORDINGS_DIR,
  TRUTH_DIR,
  argValue,
  extractClipFrames,
  hasFlag,
} from "./lib";

const LONG_SIDE = 848;

const SWEEP_SHARE_MIN = 0.5;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const video = process.argv[2];
const name = argValue("--name");
const split = argValue("--split");
if (!video || video.startsWith("--") || !name || (split !== "tune" && split !== "holdout")) {
  fail(
    "usage: bun scripts/scan/import-clip.ts <video> --name <clip> --split tune|holdout [--mode single|sweep] [--meta file] [--negative] [--force]",
  );
}
if (!/^[a-z0-9-]+$/u.test(name)) {
  fail("--name takes lowercase letters, digits and dashes only");
}
const modeArg = argValue("--mode");
if (modeArg !== undefined && modeArg !== "single" && modeArg !== "sweep") {
  fail("--mode takes single or sweep");
}
const metaFile = argValue("--meta") ?? video.replace(/\.(?:mp4|webm)$/u, ".json");
if (!fs.existsSync(metaFile)) {
  fail(`missing ${metaFile}; pass --meta <file> when it is elsewhere`);
}
const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8")) as ClipMeta;

const archive = path.join(RECORDINGS_DIR, `${name}.mp4`);
const truthFile = path.join(TRUTH_DIR, `${name}.json`);
const force = hasFlag("--force");
if (!force && (fs.existsSync(archive) || fs.existsSync(truthFile))) {
  fail(`${name} already exists; pass --force to replace it`);
}
if (
  fs.existsSync(truthFile) &&
  (JSON.parse(fs.readFileSync(truthFile, "utf-8")) as ClipTruth).reviewed
) {
  fail(`${truthFile} is reviewed; delete it by hand to re-import`);
}

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
execFileSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-y",
    "-i",
    video,
    "-an",
    "-vf",
    `fps=${DEFAULT_FPS},scale='if(gt(iw,ih),${LONG_SIDE},-2)':'if(gt(iw,ih),-2,${LONG_SIDE})'`,
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    archive,
  ],
  { stdio: "inherit" },
);
fs.copyFileSync(metaFile, path.join(RECORDINGS_DIR, `${name}.recording.json`));
const frames = extractClipFrames(name);

const catalog = loadCatalog();
const mode: ClipTruth["mode"] =
  modeArg ?? ((meta.sweepShare ?? 0) >= SWEEP_SHARE_MIN ? "sweep" : "single");
const cards = new Map<string, TruthCard>();
if (!hasFlag("--negative")) {
  for (const lock of meta.locks) {
    const identity = catalog.get(lock.key);
    if (!identity) {
      process.stdout.write(
        `  lock on ${lock.label} (${lock.key}) is not in the catalogue, skipped\n`,
      );
      continue;
    }
    const existing = cards.get(identity.artKey);
    if (existing) {
      existing.copies = (existing.copies ?? 1) + 1;
      continue;
    }
    cards.set(identity.artKey, {
      artKey: identity.artKey,
      name: identity.name,
      printing: {
        publicCode: identity.publicCode,
        language: identity.language,
        ...(identity.markers === null ? {} : { markers: identity.markers }),
      },
    });
  }
}

const truth: ClipTruth = {
  split,
  mode,
  reviewed: false,
  fps: DEFAULT_FPS,
  note: `Drafted from the phone's locks (${meta.userAgent}). Check every card and printing, add misses, then set reviewed.`,
  cards: [...cards.values()],
};
fs.mkdirSync(TRUTH_DIR, { recursive: true });
fs.writeFileSync(truthFile, `${JSON.stringify(truth, null, 2)}\n`);

process.stdout.write(
  `${name}: ${frames} frames at ${DEFAULT_FPS} fps from ${meta.durationSeconds.toFixed(1)}s of ${mode} video\n` +
    `archive: ${archive} (${(fs.statSync(archive).size / 1024 / 1024).toFixed(1)} MB)\n` +
    `draft truth: ${truthFile} (${truth.cards.length} cards, UNREVIEWED)\n`,
);
for (const card of truth.cards) {
  process.stdout.write(
    `  ${card.name} ${card.printing?.publicCode ?? ""} ${card.printing?.language ?? ""}` +
      `${card.copies ? ` x${card.copies}` : ""}\n`,
  );
}
