import type {
  BenchClipResult,
  BenchIdentity,
  BenchRun,
  ClipTruth,
  PackClip,
} from "@openrift/shared/scan/bench-score";
import {
  groupTruth,
  multiPrintingArts,
  scoreClip,
  summarize,
} from "@openrift/shared/scan/bench-score";
import { toGray } from "@openrift/shared/scan/image";
import type { CardLabels } from "@openrift/shared/scan/labels";
import { createPlacementDetector } from "@openrift/shared/scan/placement";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { ScanSessionOptions } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";

import type { SpeedSample, SpeedSummary } from "@/features/admin/lib/scan-device-bench";
import {
  frameWindows,
  realtimePacing,
  replayClip,
  summarizeSpeed,
} from "@/features/admin/lib/scan-device-bench";
import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import { describeKey, scanBankInfo } from "@/features/scan/lib/scan-bank";
import { SLOW_DEVICE_EMBED_MS } from "@/features/scan/lib/scan-embedder";
import { DEFAULT_SCANNER_SETTINGS, scanSessionPlans } from "@/features/scan/lib/scan-session";
import type { ScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import type { ScanAssets, ScanWorkerReady } from "@/features/scan/lib/scan-worker-protocol";

const PACK_URL = "/media/scan-bench";
const PACK_DEFAULT_FPS = 30;
const SPEED_WINDOWS_PER_CLIP = 2;
const SPEED_WINDOW_FRAMES = 30;
const SPEED_WARMUP_FRAMES = 5;

export type DeviceRunKind = "bench" | "speed";

export interface BenchAssets extends ScanAssets {
  bankHash: string | null;
}

export interface BenchJob {
  assets: BenchAssets;
  labels: CardLabels;
  client: ScanWorkerClient;
  onProgress: (text: string) => void;
}

export interface SpeedRun {
  meta: Record<string, string | number | boolean>;
  aimed: SpeedSummary | null;
  sweep: SpeedSummary | null;
}

type IdentityOf = (key: string) => BenchIdentity | undefined;

export function identityLookup(bank: Pick<ScanBankInfo, "labels" | "artKeys">): IdentityOf {
  return (key: string): BenchIdentity | undefined => {
    const label = bank.labels[key];
    const artKey = bank.artKeys.get(key);
    if (!label || !artKey) {
      return undefined;
    }
    return {
      name: label.name,
      artKey,
      publicCode: label.code,
      language: label.language,
      markers: label.markers ?? null,
    };
  };
}

/**
 * The served bank carries only group roots; a merged truth artwork resolves
 * through its labelled printing's keys.
 */
export function truthGroups(
  truth: ClipTruth,
  bankKeys: readonly string[],
  bankArts: ReadonlySet<string>,
  identityOf: IdentityOf,
): Map<string, string> {
  const groups = new Map<string, string>();
  for (const card of truth.cards) {
    if (bankArts.has(card.artKey)) {
      groups.set(card.artKey, card.artKey);
      continue;
    }
    const printing = card.printing;
    if (!printing) {
      continue;
    }
    const sameLanguage = new Set<string>();
    const anyLanguage = new Set<string>();
    for (const key of bankKeys) {
      const identity = identityOf(key);
      if (identity?.publicCode === printing.publicCode) {
        anyLanguage.add(identity.artKey);
        if (identity.language === printing.language) {
          sameLanguage.add(identity.artKey);
        }
      }
    }
    const candidates = sameLanguage.size > 0 ? sameLanguage : anyLanguage;
    const [only] = candidates;
    if (candidates.size === 1 && only !== undefined) {
      groups.set(card.artKey, only);
    }
  }
  return groups;
}

function clipFps(entry: PackClip): number {
  return entry.truth.fps ?? PACK_DEFAULT_FPS;
}

async function loadFrame(clip: string, index: number, canvas: HTMLCanvasElement) {
  const response = await fetch(`${PACK_URL}/${clip}/${String(index + 1).padStart(4, "0")}.jpg`);
  if (!response.ok) {
    throw new Error(`frame ${index + 1} of ${clip} is missing`);
  }
  const blob = new Blob([await response.arrayBuffer()], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("no 2d canvas");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: pixels.data, width: pixels.width, height: pixels.height } satisfies RgbaImage;
}

/** `?ortThreads=N` on the bench page pins the encoder's thread count. */
function ortThreadsParam(): number | undefined {
  const threads = Number(new URLSearchParams(globalThis.location?.search ?? "").get("ortThreads"));
  return threads > 0 ? threads : undefined;
}

interface BenchPack {
  clips: PackClip[];
  ready: ScanWorkerReady;
  bank: ScanBankInfo;
  plans: { live: Partial<ScanSessionOptions>; catchUp: Partial<ScanSessionOptions> };
  idleGate: number;
  meta: Record<string, string | number | boolean>;
  canvas: HTMLCanvasElement;
}

async function openBenchPack({ assets, labels, client, onProgress }: BenchJob): Promise<BenchPack> {
  const indexResponse = await fetch(`${PACK_URL}/index.json`);
  if (!indexResponse.ok) {
    throw new Error("No bench pack. Run bun scripts/scan/export-bench-pack.ts on the dev box.");
  }
  const pack = (await indexResponse.json()) as { clips: PackClip[] };
  onProgress("Loading the engine…");
  const ready = await client.init(
    {
      encoderUrl: assets.encoderUrl,
      bankUrl: assets.bankUrl,
      labelsUrl: assets.labelsUrl,
      detectorUrl: assets.detectorUrl,
      boardDetectorUrl: assets.boardDetectorUrl,
    },
    ortThreadsParam(),
  );
  const gates = ready.gates;
  const plans = scanSessionPlans({
    mode: "single",
    candidatesToTry: DEFAULT_SCANNER_SETTINGS.candidatesToTry,
    slowDevice: ready.embedMsPerImage > SLOW_DEVICE_EMBED_MS,
    gates,
    canonical: ready.canonical,
  });
  return {
    clips: pack.clips,
    ready,
    bank: scanBankInfo(labels, ready),
    plans,
    idleGate: gates.rotationFallbackDistance,
    meta: {
      date: new Date().toISOString(),
      device: navigator.userAgent,
      embedMsPerImage: ready.embedMsPerImage,
      bankHash: assets.bankHash ?? "unknown",
      threads: ready.threads,
    },
    canvas: document.createElement("canvas"),
  };
}

/** Replays the clips from `export-bench-pack.ts`; the result matches `run-clips.ts --json`. */
export async function runBench(job: BenchJob): Promise<BenchRun> {
  const { assets, client, onProgress } = job;
  const { clips: entries, bank, plans, idleGate, meta, canvas } = await openBenchPack(job);
  const identityOf = identityLookup(bank);
  const multiPrinting = multiPrintingArts(bank.keys, identityOf);
  const bankArts = new Set(bank.artKeys.values());

  const clips: BenchClipResult[] = [];
  for (const entry of entries) {
    const fps = clipFps(entry);
    await client.create(plans.live, plans.catchUp);
    const detector = createPlacementDetector();
    const replay = await replayClip({
      frameCount: entry.frames,
      fps,
      loadFrame: (index) => {
        const done = index + 1;
        if (done % Math.round(fps) === 0) {
          onProgress(`${entry.clip}: frame ${done} of ${entry.frames}`);
        }
        return loadFrame(entry.clip, index, canvas);
      },
      watch: (frame) =>
        detector.observe(toGray(frame), centeredGuideQuad(frame.width, frame.height)),
      process: (frame, index, seconds) => client.processFrame("live", frame, index, seconds),
      catchUp: (frame, index, seconds) => client.processFrame("catchUp", frame, index, seconds),
      rearm: () => client.rearm(),
      multiPrinting: (artKey) => multiPrinting.has(artKey),
      labelOf: (key) => describeKey(bank.labels, key),
      idleGate,
      now: () => performance.now(),
      pacing: realtimePacing(),
      behaviour: { boardReads: assets.boardDetectorUrl !== null },
    });
    const groups = truthGroups(entry.truth, bank.keys, bankArts, identityOf);
    const { locks, score } = scoreClip(groupTruth(entry.truth, groups), replay.locks, identityOf);
    clips.push({
      clip: entry.clip,
      split: entry.truth.split,
      mode: entry.truth.mode,
      reviewed: entry.truth.reviewed,
      frames: entry.frames,
      processed: replay.processed,
      frameMs: summarize(replay.frameMs),
      stageMs: replay.stageMs,
      sweepShare: replay.sweepShare,
      locks,
      score,
    });
  }
  return { meta: { ...meta, realtime: true }, clips };
}

export async function runSpeedCheck(job: BenchJob): Promise<SpeedRun> {
  const { client, onProgress } = job;
  const { clips, plans, meta, canvas } = await openBenchPack(job);
  const samples: SpeedSample[] = [];
  for (const entry of clips) {
    const fps = clipFps(entry);
    const windows = frameWindows(
      entry.frames,
      SPEED_WINDOWS_PER_CLIP,
      SPEED_WARMUP_FRAMES + SPEED_WINDOW_FRAMES,
    );
    onProgress(`${entry.clip}: ${windows.flat().length} frames`);
    for (const window of windows) {
      await client.create(plans.live, plans.catchUp);
      for (const [position, index] of window.entries()) {
        const frame = await loadFrame(entry.clip, index, canvas);
        const outcome = await client.processFrame("live", frame, position, position / fps);
        if (position >= SPEED_WARMUP_FRAMES) {
          samples.push({ sweep: outcome.sweeping, timings: outcome.timings });
        }
      }
    }
  }
  return { meta, ...summarizeSpeed(samples) };
}

/** Dev server only: results land in data/image-recognition-test/device-runs. */
export async function postDeviceRun(kind: DeviceRunKind, payload: unknown): Promise<string | null> {
  if (!import.meta.env.DEV) {
    return null;
  }
  const response = await fetch(`/__device-runs?kind=${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  return response?.ok ? await response.text() : null;
}
