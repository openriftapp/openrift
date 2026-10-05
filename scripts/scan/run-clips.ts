/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Replays every labelled clip through the scanner's own session plan and
 * scores each lock against the clip's truth file. README.md lists the flags.
 *
 * Usage: SCAN_DETECTOR=card.onnx SCAN_BOARD_DETECTOR=board.onnx bun scripts/scan/run-clips.ts [flags]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type {
  ReplayBehaviour,
  ReplayFrame,
} from "../../apps/web/src/features/admin/lib/scan-device-bench.js";
import {
  everyNthFrame,
  replayClip,
} from "../../apps/web/src/features/admin/lib/scan-device-bench.js";
import type { ScanPrintingIndex } from "../../apps/web/src/features/scan/lib/scan-resolve.js";
import type {
  BenchClipResult,
  BenchRun,
  ClipTruth,
} from "../../packages/shared/src/scan/bench-score.js";
import {
  groupTruth,
  multiPrintingArts,
  scoreClip,
  summarize,
} from "../../packages/shared/src/scan/bench-score.js";
import type { EmbedBank } from "../../packages/shared/src/scan/embed.js";
import { toGray } from "../../packages/shared/src/scan/image.js";
import { createPlacementDetector } from "../../packages/shared/src/scan/placement.js";
import { centeredGuideQuad } from "../../packages/shared/src/scan/session-options.js";
import type { FrameOutcome, ScanSession } from "../../packages/shared/src/scan/session.js";
import { createScanSession } from "../../packages/shared/src/scan/session.js";
import type { RgbaImage } from "../../packages/shared/src/scan/types.js";
import { appPrintingIndex, languageSetting, scoreAppLocks } from "./app-outcome";
import type { BenchSessionOptions } from "./bench-options";
import { benchSessionOptions } from "./bench-options";
import { createBoardDetector } from "./board-model";
import { createCardDetector } from "./card-model";
import type { CardIdentity } from "./catalog";
import { applyArtGroups, describe, loadCatalog } from "./catalog";
import type { ClipReplay, Sighting } from "./clip-report";
import { reportClip } from "./clip-report";
import { CANONICAL_BANK, EMBED_SIZE, MODEL_FILE, loadEmbedBank, nodeEmbedder } from "./embed-bank";
import {
  CLIPS,
  DEFAULT_FPS,
  REPO_ROOT,
  argValue,
  hasFlag,
  listClips,
  listReferenceImages,
  loadClipTruth,
  loadImage,
  positiveIntArg,
} from "./lib";
import { createPlacementStats, recordPlacement } from "./placement-stats";

type Catalog = Map<string, CardIdentity>;

const cardDetectorFile = process.env.SCAN_DETECTOR;
const boardDetectorFile = process.env.SCAN_BOARD_DETECTOR;
if (!cardDetectorFile || !boardDetectorFile) {
  process.stderr.write(
    "usage: SCAN_DETECTOR=card.onnx SCAN_BOARD_DETECTOR=board.onnx bun scripts/scan/run-clips.ts [flags]\n" +
      "both detectors are required\n",
  );
  process.exit(2);
}
const detectCard = createCardDetector(cardDetectorFile);
const detectBoard = createBoardDetector(boardDetectorFile);

interface ReplayContext {
  catalog: Catalog;
  bank: EmbedBank;
  referenceFiles: Map<string, string>;
  multiPrinting: Set<string>;
  options: BenchSessionOptions;
  printingIndex: ScanPrintingIndex;
  language?: string;
  trace: boolean;
  attribute: boolean;
  catchUp: boolean;
  behaviour: Partial<ReplayBehaviour>;
  dropTo: number | null;
  minSightings: number;
}

function sessionDeps(context: ReplayContext) {
  const { catalog, bank, referenceFiles } = context;
  return {
    embedder: nodeEmbedder,
    bank,
    artKeyOf: (key: string) => catalog.get(key)?.artKey ?? key,
    labelOf: (key: string) => describe(catalog, key),
    identityOf: (key: string) => {
      const identity = catalog.get(key);
      return (
        identity && {
          type: identity.cardType,
          code: identity.publicCode,
          markers: identity.markers ?? undefined,
          language: identity.language,
        }
      );
    },
    embedImageSize: EMBED_SIZE,
    fetchReference: async (key: string) => {
      const file = referenceFiles.get(key);
      return file ? await loadImage(file) : null;
    },
    detectCard,
    detectBoard,
  };
}

function noteSighting(
  sightings: Map<string, Sighting>,
  catalog: Catalog,
  key: string,
  seconds: number,
): void {
  const existing = sightings.get(key);
  if (existing) {
    existing.count++;
    return;
  }
  sightings.set(key, { key, label: describe(catalog, key), firstSeen: seconds, count: 1 });
}

function traceLine(catalog: Catalog, frame: number, outcome: FrameOutcome): string {
  const top = outcome.ranked[0];
  const ranked = top
    ? `top ${describe(catalog, top.key).padEnd(44)} d${top.distance.toFixed(3)} r${top.rotation}`
    : "no-candidate".padEnd(58);
  const verdict = outcome.winner
    ? `WIN ${outcome.winner.score} vs ${outcome.winner.rivalScore}`
    : `${outcome.refused ? "refused " : ""}best-score ${outcome.bestScore}`;
  return (
    `    #${String(frame + 1).padStart(4)} ${outcome.timings.total.toFixed(0).padStart(4)}ms ` +
    `focus ${outcome.focus.toFixed(0).padStart(4)} ${ranked} ${verdict}\n`
  );
}

async function runClip(
  clip: string,
  truth: ClipTruth,
  context: ReplayContext,
): Promise<ClipReplay> {
  const { catalog, multiPrinting, options } = context;
  const dir = path.join(CLIPS, clip);
  const frames = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .toSorted();
  const fps = truth.fps ?? DEFAULT_FPS;
  const deps = sessionDeps(context);
  const session: ScanSession = createScanSession(deps, options.live);
  const catchUpSession = context.catchUp ? createScanSession(deps, options.catchUp) : null;
  const detector = createPlacementDetector();

  const placement = createPlacementStats();
  const attribution: ClipReplay["attribution"] = new Map();
  const sightings = new Map<string, Sighting>();
  let refusedFrames = 0;

  function observe({ index, seconds, frame, outcome }: ReplayFrame): void {
    refusedFrames += outcome.refused ? 1 : 0;
    if (context.trace) {
      process.stdout.write(traceLine(catalog, index, outcome));
    }
    const top = outcome.ranked[0];
    if (context.attribute && top) {
      const art = catalog.get(top.key)?.artKey ?? top.key;
      const stats = attribution.get(art) ?? { top: 0, plausible: 0, bestScore: 0, winners: 0 };
      stats.top++;
      if (top.distance <= options.gates.rotationFallbackDistance) {
        stats.plausible++;
        stats.bestScore = Math.max(stats.bestScore, outcome.bestScore);
      }
      if (outcome.winner?.artKey === art) {
        stats.winners++;
      }
      attribution.set(art, stats);
    }
    if (outcome.candidate) {
      recordPlacement(placement, outcome.candidate.quad, frame.width, frame.height);
    }
    if (outcome.winner) {
      noteSighting(sightings, catalog, outcome.winner.key, seconds);
    }
  }

  const now = () => performance.now();
  const replay = await replayClip({
    frameCount: frames.length,
    fps,
    loadFrame: (index) => loadImage(path.join(dir, frames[index] ?? "")),
    watch: (image) => detector.observe(toGray(image), centeredGuideQuad(image.width, image.height)),
    process: (image, index, seconds) => session.processFrame(image, index, seconds, now),
    ...(catchUpSession
      ? {
          catchUp: (image: RgbaImage, index: number, seconds: number) =>
            catchUpSession.processFrame(image, index, seconds, now),
        }
      : {}),
    rearm: () => session.rearm(),
    multiPrinting: (artKey) => multiPrinting.has(artKey),
    labelOf: (key) => describe(catalog, key),
    idleGate: options.gates.rotationFallbackDistance,
    now,
    pacing: everyNthFrame(context.dropTo ? Math.max(1, Math.round(fps / context.dropTo)) : 1),
    behaviour: context.behaviour,
    onFrame: observe,
  });

  const nearLocks = [...session.state.values()]
    .filter((track) => track.lockedAt === null && track.sightings >= 3)
    .map((track) => ({
      firstSeen: track.firstSeen,
      label: track.label,
      sightings: track.sightings,
      maxRunLength: track.maxRunLength,
    }));
  const { locks: scored, score } = scoreClip(truth, replay.locks, (key) => catalog.get(key));
  return {
    truth,
    skipped: replay.skipped,
    suppressedRelocks: replay.suppressedRelocks,
    refusedFrames,
    sweepFrames: replay.sweepFrames,
    stillFrames: replay.stillFrames,
    boardReads: replay.boardReads,
    placements: replay.placements,
    missedPlacements: replay.missedPlacements,
    catchUpRuns: replay.catchUpRuns,
    recoveredAsk: replay.recoveredAsk,
    placement,
    attribution,
    sightings: [...sightings.values()]
      .toSorted((a, b) => a.firstSeen - b.firstSeen)
      .filter((sighting) => sighting.count >= context.minSightings),
    nearLocks,
    result: {
      clip,
      split: truth.split,
      mode: truth.mode,
      reviewed: truth.reviewed,
      frames: frames.length,
      processed: replay.processed,
      frameMs: summarize(replay.frameMs),
      stageMs: replay.stageMs,
      sweepShare: replay.sweepShare,
      locks: scored,
      score,
      app: scoreAppLocks(truth, scored, catalog, context.printingIndex, context.language),
    },
  };
}

function gitRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const dropTo = positiveIntArg("--drop-to") ?? null;
  const minSightings = positiveIntArg("--min-sightings") ?? 4;
  const catalog = loadCatalog();
  const only = argValue("--clip");
  const split = argValue("--split");
  const onlyMode = argValue("--only-mode");
  const jsonOut = argValue("--json");
  const bank = await loadEmbedBank(hasFlag("--force-bank"));
  const groupOf = hasFlag("--no-art-groups")
    ? new Map<string, string>()
    : await applyArtGroups(catalog, bank, !hasFlag("--no-illustration-groups"));
  const context: ReplayContext = {
    catalog,
    bank,
    referenceFiles: new Map(listReferenceImages().map((entry) => [entry.key, entry.file])),
    multiPrinting: multiPrintingArts(bank.keys, (key) => catalog.get(key)),
    options: benchSessionOptions(bank),
    printingIndex: appPrintingIndex(catalog, hasFlag("--refresh-printings")),
    language: languageSetting(),
    trace: hasFlag("--trace"),
    attribute: hasFlag("--attribute"),
    catchUp: !hasFlag("--no-catch-up"),
    behaviour: {
      rearm: !hasFlag("--no-rearm"),
      skipDisturbed: !hasFlag("--no-skip-disturbed"),
      relockGuard: !hasFlag("--no-relock-guard"),
    },
    dropTo,
    minSightings,
  };

  const results: BenchClipResult[] = [];
  let boardReads = 0;
  for (const clip of listClips()) {
    if (only && clip !== only) {
      continue;
    }
    const truth = loadClipTruth(clip);
    if (!truth) {
      process.stdout.write(`\n${clip}: no truth.json, skipped\n`);
      continue;
    }
    if ((split && truth.split !== split) || (onlyMode && truth.mode !== onlyMode)) {
      continue;
    }
    const replay = await runClip(clip, groupTruth(truth, groupOf), context);
    reportClip(replay, {
      accept: context.options.live.accept,
      attribute: context.attribute,
      catchUp: context.catchUp,
      verbose: hasFlag("--verbose"),
    });
    results.push(replay.result);
    boardReads += replay.boardReads.length;
  }

  const totals = results.reduce(
    (sum, result) => ({
      found: sum.found + result.score.found,
      expected: sum.expected + result.score.expected,
      wrong: sum.wrong + result.score.wrongCards + result.score.wrongPrintings,
    }),
    { found: 0, expected: 0, wrong: 0 },
  );
  process.stdout.write(
    `\nTOTAL found ${totals.found}/${totals.expected}, wrong locks ${totals.wrong}, ` +
      `board reads ${boardReads}\n`,
  );

  if (jsonOut) {
    const run: BenchRun = {
      meta: {
        date: new Date().toISOString(),
        revision: gitRevision(),
        encoder: path.basename(MODEL_FILE),
        embedSize: EMBED_SIZE,
        canonicalBank: CANONICAL_BANK,
        bankEntries: bank.keys.length,
        args: process.argv.slice(2).join(" "),
      },
      clips: results,
    };
    fs.writeFileSync(jsonOut, `${JSON.stringify(run, null, 2)}\n`);
    process.stdout.write(`wrote ${jsonOut}\n`);
  }
}

await main();
