import { formatFileStamp } from "@openrift/shared/format-date";

import type { FrameLogEntry } from "@/features/scan/lib/scan-frame-log";
import type { LockedCard } from "@/features/scan/lib/scan-locks";
import type { ScannerMode } from "@/features/scan/lib/scan-session";

/** Bits per second. */
export const RECORDING_BITRATE = 16_000_000;

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickRecordingMimeType(isSupported: (type: string) => boolean): string | null {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? null;
}

export function recordingExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

export function clipFileBase(startedAt: Date, mode: ScannerMode): string {
  return `scan-clip-${formatFileStamp(startedAt)}-${mode}`;
}

interface ClipLock {
  seconds: number;
  key: string;
  label: string;
  framesToLock: number;
  /** Percent. */
  score: number;
}

/** `seconds` from the start of the recording to the frame's grab. */
export interface ClipFrame extends Omit<FrameLogEntry, "grabbedAt"> {
  seconds: number;
}

export interface ClipMeta {
  version: 1;
  recordedAt: string;
  durationSeconds: number;
  mode: ScannerMode;
  processingSize: number;
  mimeType: string;
  userAgent: string;
  camera: Record<string, string | number | boolean>;
  locks: ClipLock[];
  /** Fraction 0..1 of processed frames the session reported as sweeping. */
  sweepShare?: number;
  frames?: ClipFrame[];
}

export interface ClipMetaInput {
  startedAt: number;
  stoppedAt: number;
  mode: ScannerMode;
  processingSize: number;
  mimeType: string;
  userAgent: string;
  camera: Record<string, unknown>;
  locks: readonly LockedCard[];
  frames?: ClipFrame[];
}

export interface FileSharer {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
}

export async function deliverFiles(
  files: File[],
  sharer: FileSharer,
  download: (file: File) => void,
): Promise<"shared" | "downloaded" | "cancelled"> {
  if (sharer.share && sharer.canShare?.({ files })) {
    try {
      await sharer.share({ files });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  for (const file of files) {
    download(file);
  }
  return "downloaded";
}

/** `startedAt`, `stoppedAt` and each lock's `at` are epoch milliseconds. */
export function buildClipMeta(input: ClipMetaInput): ClipMeta {
  const camera: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input.camera)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      camera[key] = value;
    }
  }
  return {
    version: 1,
    recordedAt: new Date(input.startedAt).toISOString(),
    durationSeconds: (input.stoppedAt - input.startedAt) / 1000,
    mode: input.mode,
    processingSize: input.processingSize,
    mimeType: input.mimeType,
    userAgent: input.userAgent,
    camera,
    locks: input.locks
      .filter((lock) => lock.at >= input.startedAt && lock.at <= input.stoppedAt)
      .map((lock) => ({
        seconds: (lock.at - input.startedAt) / 1000,
        key: lock.key,
        label: lock.label,
        framesToLock: lock.framesToLock,
        score: lock.score,
      })),
    ...(input.frames === undefined
      ? {}
      : {
          sweepShare:
            input.frames.length === 0
              ? 0
              : input.frames.filter((frame) => frame.sweeping).length / input.frames.length,
          frames: input.frames,
        }),
  };
}
