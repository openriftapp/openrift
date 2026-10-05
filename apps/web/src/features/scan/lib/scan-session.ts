/** Session plans are plain data: they cross to the worker in a message and cannot carry callbacks. */

import type { CardEmbedder } from "@openrift/shared/scan/embed";
import type { ScanSession } from "@openrift/shared/scan/session";
import { createScanSession } from "@openrift/shared/scan/session";
import type { EncoderGates, ScanSessionOptions } from "@openrift/shared/scan/session-options";
import { DEFAULT_SESSION_OPTIONS } from "@openrift/shared/scan/session-options";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";

import type { LoadedScanBank } from "@/features/scan/lib/scan-bank";
import { describeKey } from "@/features/scan/lib/scan-bank";
import { fetchReference } from "@/features/scan/lib/scan-reference-image";

/**
 * `single` scans continuously and switches itself into a sweep over several
 * cards or into counting copies on a stand; `capture` runs once per tap.
 */
export type ScannerMode = "single" | "capture";

export interface ScannerSettings {
  mode: ScannerMode;
  paused: boolean;
  processingSize: number;
  candidatesToTry: number;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  mode: "single",
  paused: false,
  processingSize: 848,
  candidatesToTry: DEFAULT_SESSION_OPTIONS.candidatesToTry,
};

const SINGLE_MODE_TOP_K = 4;
const SLOW_DEVICE_TOP_K = 2;

export interface ScanSessionPlanInput {
  mode: ScannerMode;
  candidatesToTry: number;
  slowDevice: boolean;
  gates: EncoderGates;
  canonical: boolean;
}

export function lockRunForMode(mode: ScannerMode): number {
  return mode === "capture" ? 1 : 3;
}

export function scanSessionPlans(input: ScanSessionPlanInput): {
  live: Partial<ScanSessionOptions>;
  catchUp: Partial<ScanSessionOptions>;
} {
  const { mode, candidatesToTry, slowDevice, gates, canonical } = input;
  return {
    live: {
      candidatesToTry: slowDevice ? Math.min(1, candidatesToTry) : candidatesToTry,
      confidentDistance: gates.confidentDistance,
      rotationFallbackDistance: slowDevice
        ? gates.slowRotationFallbackDistance
        : gates.rotationFallbackDistance,
      topK: Math.min(gates.topK, slowDevice ? SLOW_DEVICE_TOP_K : SINGLE_MODE_TOP_K),
      rotationPairOnly: canonical,
      accept:
        mode === "capture"
          ? { lockRun: lockRunForMode("capture"), maxGapFrames: 0 }
          : {
              ...DEFAULT_SESSION_OPTIONS.accept,
              lockRun: lockRunForMode(mode),
              weighted: true,
              // Without this, counted copies drift with the device's frame
              // rate; single mode adds its own guard in scan-relock.ts.
              relockOnlyAfterRearm: true,
            },
      sweep: mode === "single",
    },
    catchUp: {
      candidatesToTry,
      confidentDistance: gates.confidentDistance,
      rotationFallbackDistance: gates.rotationFallbackDistance,
      topK: Math.min(gates.topK, SINGLE_MODE_TOP_K),
      rotationPairOnly: canonical,
      accept: { lockRun: Number.POSITIVE_INFINITY, maxGapFrames: 0 },
    },
  };
}

export interface ScanEngine {
  embedder: CardEmbedder;
  embedImageSize: number;
  detectCard: (frame: RgbaImage) => Promise<CardCandidate[]>;
  detectBoard: (frame: RgbaImage) => Promise<CardCandidate[]>;
}

export function createConfiguredScanSession(
  engine: ScanEngine,
  loaded: LoadedScanBank,
  plan: Partial<ScanSessionOptions>,
): ScanSession {
  return createScanSession(
    {
      embedder: engine.embedder,
      bank: loaded.bank,
      artKeyOf: (key) => loaded.artKeys.get(key) ?? key,
      labelOf: (key) => describeKey(loaded.labels, key),
      identityOf: (key) => {
        const label = loaded.labels[key];
        return label && { ...label, markers: label.markers ?? undefined };
      },
      embedImageSize: engine.embedImageSize,
      fetchReference,
      detectCard: engine.detectCard,
      detectBoard: engine.detectBoard,
    },
    plan,
  );
}
