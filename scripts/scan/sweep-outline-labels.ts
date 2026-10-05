/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Detector training only: proposes card outlines on the sweep and auto clips, keeping an outline
 * as a card when the recognizer names it and the aligned check agrees, else as an ignore region.
 * Usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/sweep-outline-labels.ts out-dir [--every 5]
 */
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_ALIGNED_OPTIONS } from "../../packages/shared/src/scan/accept.js";
import {
  alignedScore,
  alignedSignature,
  referenceSignature,
} from "../../packages/shared/src/scan/aligned-verify.js";
import { rankCardEmbedding } from "../../packages/shared/src/scan/embed.js";
import { quadIou } from "../../packages/shared/src/scan/geometry.js";
import {
  SESSION_UNWARP_HEIGHT,
  SESSION_UNWARP_WIDTH,
  gatesForBank,
} from "../../packages/shared/src/scan/session-options.js";
import type { Quad } from "../../packages/shared/src/scan/types.js";
import { unwarpCard } from "../../packages/shared/src/scan/unwarp.js";
import { createBoardDetector } from "./board-model";
import { EMBED_SIZE, loadEmbedBank, nodeEmbedder } from "./embed-bank";
import {
  CLIPS,
  listClips,
  listReferenceImages,
  loadClipTruth,
  loadImage,
  positiveIntArg,
} from "./lib";

const outDir = process.argv[2];
const every = positiveIntArg("--every") ?? 5;
const modelFile = process.env.SCAN_BOARD_DETECTOR;
if (!outDir || !modelFile) {
  process.stderr.write(
    "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/sweep-outline-labels.ts out-dir [--every 5]\n",
  );
  process.exit(2);
}

const SAME_CARD_IOU = 0.5;

async function main(): Promise<void> {
  const detect = createBoardDetector(modelFile as string);
  const bank = await loadEmbedBank();
  const gates = gatesForBank(bank);
  const references = new Map(listReferenceImages().map((entry) => [entry.key, entry.file]));
  fs.mkdirSync(outDir as string, { recursive: true });

  async function judge(frame: Awaited<ReturnType<typeof loadImage>>, quad: Quad): Promise<boolean> {
    const card = unwarpCard(frame, quad, SESSION_UNWARP_WIDTH, SESSION_UNWARP_HEIGHT, 0);
    if (!card) {
      return false;
    }
    const ranked = await rankCardEmbedding(card, nodeEmbedder, bank, {
      topK: 1,
      confidentDistance: gates.confidentDistance,
      rotationFallbackDistance: gates.rotationFallbackDistance,
      imageSize: EMBED_SIZE,
    });
    const top = ranked[0];
    const file = top ? references.get(top.key) : undefined;
    if (!top || !file || top.distance > gates.confidentDistance) {
      return false;
    }
    const reference = await loadImage(file);
    return (
      alignedScore(alignedSignature(card, top.rotation), referenceSignature(reference)) >=
      DEFAULT_ALIGNED_OPTIONS.minScore
    );
  }

  for (const clip of listClips()) {
    const truth = loadClipTruth(clip);
    if (!truth || truth.mode === "single" || truth.cards.length === 0) {
      continue;
    }
    const frames = fs
      .readdirSync(path.join(CLIPS, clip))
      .filter((file) => file.endsWith(".jpg"))
      .toSorted()
      .filter((_, index) => index % every === 0);
    const labels: { frame: string; cards: Quad[]; ignore: Quad[] }[] = [];
    let judged = 0;
    for (const file of frames) {
      const frame = await loadImage(path.join(CLIPS, clip, file));
      const detected = await detect(frame);
      const cards: Quad[] = [];
      const ignore: Quad[] = [];
      for (const { quad } of detected) {
        if (cards.some((card) => quadIou(card, quad) >= SAME_CARD_IOU)) {
          continue;
        }
        if (await judge(frame, quad)) {
          cards.push(quad);
          judged++;
        } else {
          ignore.push(quad);
        }
      }
      labels.push({ frame: file, cards, ignore });
    }
    fs.writeFileSync(
      path.join(outDir as string, `${clip}.json`),
      `${JSON.stringify({ clip, every, labels }, null, 1)}\n`,
    );
    process.stdout.write(`${clip}: ${labels.length} frames, ${judged} judged cards\n`);
  }
}

await main();
