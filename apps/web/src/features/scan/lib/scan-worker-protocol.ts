import type { BoardCard } from "@openrift/shared/scan/board";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { EncoderGates, ScanSessionOptions } from "@openrift/shared/scan/session-options";

export type DownloadPart = "encoder" | "bank";

export type SessionKind = "live" | "catchUp";

export interface ScanAssets {
  encoderUrl: string;
  bankUrl: string;
  labelsUrl: string;
  detectorUrl: string;
  boardDetectorUrl: string | null;
}

export interface ScanWorkerInit extends ScanAssets {
  type: "init";
  wasmPaths: { wasm: string };
  ortThreads?: number;
}

export type ScanWorkerRequest =
  | ScanWorkerInit
  | {
      type: "create";
      id: number;
      live: Partial<ScanSessionOptions>;
      catchUp: Partial<ScanSessionOptions>;
    }
  | {
      type: "frame";
      id: number;
      kind: SessionKind;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      index: number;
      seconds: number;
    }
  | { type: "board"; id: number; buffer: ArrayBuffer; width: number; height: number }
  | { type: "rearm" };

export interface ScanWorkerReady {
  embedMsPerImage: number;
  embedImageSize: number;
  threads: number;
  keys: string[];
  /** Bank key to artwork key, as Map entries. */
  artKeys: [string, string][];
  canonical: boolean;
  bytes: number;
  gates: EncoderGates;
}

export type ScanWorkerErrorCode = "detector" | "loading";

export type ScanWorkerResponse =
  | { type: "progress"; part: DownloadPart; loaded: number; total: number }
  | ({ type: "ready" } & ScanWorkerReady)
  | { type: "created"; id: number }
  | { type: "outcome"; id: number; outcome: FrameOutcome }
  | { type: "board"; id: number; cards: BoardCard[] }
  | { type: "error"; id?: number; message: string; code?: ScanWorkerErrorCode };
