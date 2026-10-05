import type { BoardCard } from "@openrift/shared/scan/board";
import type { CardLabels } from "@openrift/shared/scan/labels";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import { DEFAULT_SESSION_OPTIONS } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";
import { useEffect, useRef, useState } from "react";

import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import { scanBankInfo } from "@/features/scan/lib/scan-bank";
import { SLOW_DEVICE_EMBED_MS } from "@/features/scan/lib/scan-embedder";
import type { DownloadProgress } from "@/features/scan/lib/scan-load-progress";
import { INITIAL_DOWNLOAD_PROGRESS } from "@/features/scan/lib/scan-load-progress";
import type { ScannerSettings } from "@/features/scan/lib/scan-session";
import { scanSessionPlans } from "@/features/scan/lib/scan-session";
import type { ScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import { createScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import type {
  DownloadPart,
  ScanAssets,
  ScanWorkerReady,
  SessionKind,
} from "@/features/scan/lib/scan-worker-protocol";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

export interface ScanEngineHandle {
  engineReady: boolean;
  embedMsPerImage: number;
  slowDevice: boolean;
  progress: DownloadProgress;
  threads: number | null;
  error: string | null;
  bank: ScanBankInfo | null;
  bankKey: string | null;
  idleGate: number;
  hasSession: () => boolean;
  prepare: (settings: ScannerSettings, inFlight: Promise<unknown> | null) => Promise<boolean>;
  processFrame: (
    kind: SessionKind,
    frame: RgbaImage,
    index: number,
    seconds: number,
  ) => Promise<FrameOutcome | null>;
  readBoard: (still: RgbaImage) => Promise<BoardCard[] | null>;
  rearm: () => void;
}

async function frameSettled(frame: Promise<unknown> | null): Promise<void> {
  try {
    await frame;
  } catch {
    // The frame loop reports its own failure.
  }
}

function startWorker(
  onProgress: (part: DownloadPart, loaded: number, total: number) => void,
): ScanWorkerClient | null {
  try {
    return createScanWorkerClient(onProgress);
  } catch (workerError) {
    console.log(`[scan] worker unavailable: ${String(workerError)}`);
    return null;
  }
}

export function useScanEngine(
  assets: ScanAssets | null,
  labels: CardLabels | null,
): ScanEngineHandle {
  const workerRef = useRef<ScanWorkerClient | null>(null);
  const sessionWorkerRef = useRef<ScanWorkerClient | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; ready: ScanWorkerReady } | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>(INITIAL_DOWNLOAD_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  // Primitive deps: the assets object's identity is render-derived and an
  // identity change mid-download would orphan the load.
  const encoderUrl = assets?.encoderUrl ?? null;
  const bankUrl = assets?.bankUrl ?? null;
  const labelsUrl = assets?.labelsUrl ?? null;
  const detectorUrl = assets?.detectorUrl ?? null;
  const boardDetectorUrl = assets?.boardDetectorUrl ?? null;
  const assetKey = [encoderUrl, bankUrl, labelsUrl, detectorUrl, boardDetectorUrl].join("\n");
  const ready = loaded?.key === assetKey ? loaded.ready : null;
  useEffect(() => {
    if (encoderUrl === null || bankUrl === null || labelsUrl === null || detectorUrl === null) {
      return;
    }
    const key = [encoderUrl, bankUrl, labelsUrl, detectorUrl, boardDetectorUrl].join("\n");
    let cancelled = false;
    const started =
      typeof Worker === "undefined"
        ? null
        : startWorker((part, loadedBytes, totalBytes) => {
            if (!cancelled) {
              setProgress((previous) => ({
                ...previous,
                [part]: { loaded: loadedBytes, total: totalBytes, ready: false },
              }));
            }
          });
    async function init(client: ScanWorkerClient): Promise<void> {
      let initialized: ScanWorkerReady | null = null;
      let failure: string | null = null;
      try {
        initialized = await client.init({
          encoderUrl: encoderUrl as string,
          bankUrl: bankUrl as string,
          labelsUrl: labelsUrl as string,
          detectorUrl: detectorUrl as string,
          boardDetectorUrl,
        });
      } catch (initError) {
        failure = errorText(initError, m.scan_engine_start_failed());
      }
      if (cancelled) {
        return;
      }
      if (initialized === null) {
        client.terminate();
        setError(failure ?? m.scan_engine_start_failed());
        return;
      }
      console.log(
        `[scan] worker ready: ${initialized.embedMsPerImage.toFixed(0)}ms/image, input ${initialized.embedImageSize}`,
      );
      workerRef.current = client;
      setError(null);
      setLoaded({ key, ready: initialized });
      setProgress((previous) => ({
        encoder: { ...previous.encoder, ready: true },
        bank: { ...previous.bank, ready: true },
      }));
    }
    if (started === null) {
      // oxlint-disable-next-line react/set-state-in-effect -- the browser's worker support is only known in an effect
      setError(m.scan_engine_worker_unsupported());
      return;
    }
    void init(started);
    return () => {
      cancelled = true;
      if (workerRef.current === started) {
        workerRef.current = null;
      }
      started.terminate();
    };
  }, [encoderUrl, bankUrl, labelsUrl, detectorUrl, boardDetectorUrl]);

  const bank = ready !== null && labels !== null ? scanBankInfo(labels, ready) : null;
  const embedMsPerImage = ready?.embedMsPerImage ?? 0;
  const slowDevice = embedMsPerImage > SLOW_DEVICE_EMBED_MS;

  function hasSession(): boolean {
    return workerRef.current !== null && sessionWorkerRef.current === workerRef.current;
  }

  async function prepare(
    settings: ScannerSettings,
    inFlight: Promise<unknown> | null,
  ): Promise<boolean> {
    await frameSettled(inFlight);
    const worker = workerRef.current;
    if (!worker || !ready || !bank) {
      return false;
    }
    if (slowDevice) {
      console.log(`[scan] slow-device profile (${ready.embedMsPerImage.toFixed(0)}ms/image)`);
    }
    const plans = scanSessionPlans({
      mode: settings.mode,
      candidatesToTry: settings.candidatesToTry,
      slowDevice,
      gates: ready.gates,
      canonical: ready.canonical,
    });
    let created = false;
    let failure: unknown = null;
    try {
      await worker.create(plans.live, plans.catchUp);
      created = true;
    } catch (createError) {
      failure = createError;
    }
    if (workerRef.current !== worker) {
      return false;
    }
    if (!created) {
      throw failure;
    }
    sessionWorkerRef.current = worker;
    return true;
  }

  async function processFrame(
    kind: SessionKind,
    frame: RgbaImage,
    index: number,
    seconds: number,
  ): Promise<FrameOutcome | null> {
    const worker = workerRef.current;
    if (!worker || sessionWorkerRef.current !== worker) {
      return null;
    }
    let outcome: FrameOutcome | null = null;
    let failure: unknown = null;
    try {
      outcome = await worker.processFrame(kind, frame, index, seconds);
    } catch (frameError) {
      failure = frameError;
    }
    if (outcome === null && workerRef.current === worker) {
      throw failure;
    }
    return outcome;
  }

  async function readBoard(still: RgbaImage): Promise<BoardCard[] | null> {
    const worker = workerRef.current;
    if (!worker) {
      return null;
    }
    let cards: BoardCard[] | null = null;
    let failure: unknown = null;
    try {
      cards = await worker.readBoard(still);
    } catch (boardError) {
      failure = boardError;
    }
    if (cards === null && workerRef.current === worker) {
      throw failure;
    }
    return cards;
  }

  function rearm(): void {
    workerRef.current?.rearm();
  }

  return {
    engineReady: ready !== null,
    embedMsPerImage,
    slowDevice,
    progress,
    threads: ready?.threads ?? null,
    error,
    bank,
    bankKey: bank === null ? null : assetKey,
    idleGate:
      ready?.gates.rotationFallbackDistance ?? DEFAULT_SESSION_OPTIONS.rotationFallbackDistance,
    hasSession,
    prepare,
    processFrame,
    readBoard,
    rearm,
  };
}
