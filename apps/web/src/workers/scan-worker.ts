import type { BoardCard } from "@openrift/shared/scan/board";
import { boardOptionsFor, readBoard } from "@openrift/shared/scan/board";
import type { ScanSession } from "@openrift/shared/scan/session";
import type { EncoderGates } from "@openrift/shared/scan/session-options";
import { gatesForBank } from "@openrift/shared/scan/session-options";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";

import type { LoadedScanBank } from "@/features/scan/lib/scan-bank";
import { loadScanBank } from "@/features/scan/lib/scan-bank";
import type { DetectCards } from "@/features/scan/lib/scan-detector";
import { loadBoardDetector, loadCardDetector } from "@/features/scan/lib/scan-detector";
import {
  embedderImageSize,
  embedderThreads,
  loadScanEmbedder,
  measuredEmbedMsPerImage,
} from "@/features/scan/lib/scan-embedder";
import { fetchReference } from "@/features/scan/lib/scan-reference-image";
import type { ScanEngine } from "@/features/scan/lib/scan-session";
import { catalogLookups, createConfiguredScanSession } from "@/features/scan/lib/scan-session";
import type {
  DownloadPart,
  ScanWorkerErrorCode,
  ScanWorkerRequest,
  ScanWorkerResponse,
  SessionKind,
} from "@/features/scan/lib/scan-worker-protocol";

class ScanWorkerError extends Error {
  readonly code: ScanWorkerErrorCode;

  constructor(code: ScanWorkerErrorCode, message: string) {
    super(message);
    this.name = "ScanWorkerError";
    this.code = code;
  }
}

/**
 * Deliberately not `/// <reference lib="webworker" />`: that would re-type
 * shared globals like `Event` and break unrelated DOM code.
 */
interface WorkerScope {
  postMessage: (message: unknown) => void;
  addEventListener: (
    type: "message",
    listener: (event: { data: ScanWorkerRequest }) => void,
  ) => void;
}

const scope = globalThis as unknown as WorkerScope;

let loaded: { engine: ScanEngine; bank: LoadedScanBank; gates: EncoderGates } | null = null;
let boardDetectorUrl: string | null = null;
let boardDetector: DetectCards | null = null;
let boardDetectorLoading: Promise<DetectCards | null> | null = null;
let boardDetectorFailedAt = Number.NEGATIVE_INFINITY;
const BOARD_RETRY_MS = 30_000;
const sessions = new Map<SessionKind, ScanSession>();

async function loadBoardDetectorNow(): Promise<DetectCards | null> {
  if (boardDetector || boardDetectorUrl === null) {
    return boardDetector;
  }
  if (!boardDetectorLoading && Date.now() - boardDetectorFailedAt >= BOARD_RETRY_MS) {
    const url = boardDetectorUrl;
    boardDetectorLoading = (async () => {
      try {
        boardDetector = await loadBoardDetector(url);
      } catch (error) {
        boardDetectorFailedAt = Date.now();
        console.warn("[scan] board detector unavailable", error);
      }
      boardDetectorLoading = null;
      return boardDetector;
    })();
  }
  return (await boardDetectorLoading) ?? boardDetector;
}

function boardDetectorOrNull(): DetectCards | null {
  if (!boardDetector) {
    void loadBoardDetectorNow();
  }
  return boardDetector;
}

async function readStill(still: RgbaImage): Promise<BoardCard[]> {
  const detect = boardDetectorOrNull();
  if (!detect || !loaded) {
    return [];
  }
  const { engine, bank, gates } = loaded;
  return await readBoard(
    still,
    detect,
    {
      embedder: engine.embedder,
      bank: bank.bank,
      embedImageSize: engine.embedImageSize,
      ...catalogLookups(bank),
      fetchReference,
    },
    boardOptionsFor(gates, bank.canonical),
  );
}

/** Waits for the encoder: the shared onnxruntime-web module is configured there. */
async function loadCardDetectorAfterEncoder(
  url: string,
  embedderLoad: Promise<unknown>,
): Promise<DetectCards> {
  await embedderLoad;
  try {
    return await loadCardDetector(url);
  } catch (error) {
    console.warn("[scan] card detector unavailable", error);
    throw new ScanWorkerError("detector", "the card detector did not load");
  }
}

async function detectBoardWhenLoaded(frame: RgbaImage): Promise<CardCandidate[]> {
  const detect = boardDetectorOrNull();
  return detect ? await detect(frame) : [];
}

scope.addEventListener("message", (event) => {
  void handle(event.data);
});

async function handle(request: ScanWorkerRequest): Promise<void> {
  try {
    if (request.type === "init") {
      boardDetectorUrl = request.boardDetectorUrl;
      const progressOf = (part: DownloadPart) => (bytes: number, total: number) =>
        post({ type: "progress", part, loaded: bytes, total });
      const embedderLoad = loadScanEmbedder(
        request.encoderUrl,
        request.wasmPaths,
        progressOf("encoder"),
        request.ortThreads,
      );
      const [loadedEmbedder, loadedBank, loadedDetector] = await Promise.all([
        embedderLoad,
        loadScanBank(request.bankUrl, request.labelsUrl, progressOf("bank")),
        loadCardDetectorAfterEncoder(request.detectorUrl, embedderLoad),
      ]);
      const gates = gatesForBank(loadedBank.bank);
      loaded = {
        engine: {
          embedder: loadedEmbedder,
          embedImageSize: embedderImageSize(),
          detectCard: loadedDetector,
          detectBoard: detectBoardWhenLoaded,
        },
        bank: loadedBank,
        gates,
      };
      post({
        type: "ready",
        embedMsPerImage: measuredEmbedMsPerImage(),
        embedImageSize: embedderImageSize(),
        threads: embedderThreads(),
        keys: loadedBank.bank.keys,
        artKeys: [...loadedBank.artKeys],
        canonical: loadedBank.canonical,
        bytes: loadedBank.bytes,
        gates,
      });
      void loadBoardDetectorNow();
      return;
    }

    if (request.type === "create") {
      sessions.clear();
      if (!loaded) {
        throw new ScanWorkerError("loading", "the engine is still loading");
      }
      sessions.set("live", createConfiguredScanSession(loaded.engine, loaded.bank, request.live));
      sessions.set(
        "catchUp",
        createConfiguredScanSession(loaded.engine, loaded.bank, request.catchUp),
      );
      post({ type: "created", id: request.id });
      return;
    }

    if (request.type === "rearm") {
      sessions.get("live")?.rearm();
      return;
    }

    if (request.type === "board") {
      const still: RgbaImage = {
        data: new Uint8ClampedArray(request.buffer),
        width: request.width,
        height: request.height,
      };
      const cards = await readStill(still);
      sessions.get("live")?.noteBoard(cards, still);
      post({ type: "board", id: request.id, cards });
      return;
    }

    const session = sessions.get(request.kind);
    if (!session) {
      post({ type: "error", id: request.id, message: "no session", code: "loading" });
      return;
    }
    const frame: RgbaImage = {
      data: new Uint8ClampedArray(request.buffer),
      width: request.width,
      height: request.height,
    };
    const outcome = await session.processFrame(frame, request.index, request.seconds, () =>
      performance.now(),
    );
    post({ type: "outcome", id: request.id, outcome });
  } catch (error) {
    post({
      type: "error",
      id: "id" in request ? request.id : undefined,
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof ScanWorkerError ? { code: error.code } : {}),
    });
  }
}

function post(response: ScanWorkerResponse): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes no target origin
  scope.postMessage(response);
}
