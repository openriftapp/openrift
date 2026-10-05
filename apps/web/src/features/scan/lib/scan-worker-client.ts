/** Frame buffers are transferred, so the caller must not read a frame after handing it over. */
import type { BoardCard } from "@openrift/shared/scan/board";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { ScanSessionOptions } from "@openrift/shared/scan/session-options";

import { ORT_WASM_PATHS } from "@/features/scan/lib/scan-ort-assets";
import type {
  DownloadPart,
  ScanAssets,
  ScanWorkerErrorCode,
  ScanWorkerReady,
  ScanWorkerRequest,
  ScanWorkerResponse,
  SessionKind,
} from "@/features/scan/lib/scan-worker-protocol";
import { m } from "@/paraglide/messages.js";

export interface ScanWorkerClient {
  init: (assets: ScanAssets, ortThreads?: number) => Promise<ScanWorkerReady>;
  create: (
    live: Partial<ScanSessionOptions>,
    catchUp: Partial<ScanSessionOptions>,
  ) => Promise<void>;
  processFrame: (
    kind: SessionKind,
    frame: { data: Uint8ClampedArray; width: number; height: number },
    index: number,
    seconds: number,
  ) => Promise<FrameOutcome>;
  readBoard: (frame: StillFrame) => Promise<BoardCard[]>;
  rearm: () => void;
  terminate: () => void;
}

interface StillFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function transferable(data: Uint8ClampedArray): ArrayBuffer {
  // A view into a larger buffer can't be transferred piecemeal; slice copies it.
  return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
    ? (data.buffer as ArrayBuffer)
    : (new Uint8ClampedArray(data).buffer as ArrayBuffer);
}

function workerErrorText(message: string, code?: ScanWorkerErrorCode): string {
  if (code === "detector") {
    return m.scan_engine_detector_failed();
  }
  if (code === "loading") {
    return m.scan_engine_still_loading();
  }
  return message;
}

function replyValue(
  message: Extract<ScanWorkerResponse, { type: "created" | "outcome" | "board" }>,
): unknown {
  if (message.type === "outcome") {
    return message.outcome;
  }
  return message.type === "board" ? message.cards : undefined;
}

/** Throws synchronously when the browser will not create the worker at all. */
export function createScanWorkerClient(
  onProgress?: (part: DownloadPart, loaded: number, total: number) => void,
): ScanWorkerClient {
  const worker = new Worker(new URL("@/workers/scan-worker.ts", import.meta.url), {
    type: "module",
    name: "scan",
  });

  let nextId = 1;
  const pending = new Map<number, { resolve: (r: never) => void; reject: (e: Error) => void }>();
  let readyResolve: ((ready: ScanWorkerReady) => void) | null = null;
  let readyReject: ((error: Error) => void) | null = null;

  worker.addEventListener("message", (event: MessageEvent<ScanWorkerResponse>) => {
    const message = event.data;
    if (message.type === "progress") {
      onProgress?.(message.part, message.loaded, message.total);
      return;
    }
    if (message.type === "ready") {
      const { type: _type, ...ready } = message;
      readyResolve?.(ready);
      readyResolve = null;
      readyReject = null;
      return;
    }
    if (message.type === "created" || message.type === "outcome" || message.type === "board") {
      (pending.get(message.id)?.resolve as ((r: unknown) => void) | undefined)?.(
        replyValue(message),
      );
      pending.delete(message.id);
      return;
    }
    const error = new Error(workerErrorText(message.message, message.code));
    if (message.id === undefined) {
      readyReject?.(error);
      readyReject = null;
      readyResolve = null;
      return;
    }
    pending.get(message.id)?.reject(error);
    pending.delete(message.id);
  });

  worker.addEventListener("error", (event) => {
    const error = new Error(event.message || "the scan worker stopped");
    readyReject?.(error);
    readyReject = null;
    readyResolve = null;
    for (const waiter of pending.values()) {
      waiter.reject(error);
    }
    pending.clear();
  });

  const send = (request: ScanWorkerRequest, transfer?: Transferable[]) => {
    worker.postMessage(request, transfer ?? []);
  };

  return {
    init(assets, ortThreads) {
      /* oxlint-disable-next-line promise/avoid-new -- bridging a message protocol to a promise */
      return new Promise<ScanWorkerReady>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
        send({
          type: "init",
          ...assets,
          wasmPaths: ORT_WASM_PATHS,
          ...(ortThreads === undefined ? {} : { ortThreads }),
        });
      });
    },
    create(live, catchUp) {
      const id = nextId++;
      /* oxlint-disable-next-line promise/avoid-new -- bridging a message protocol to a promise */
      return new Promise<void>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (r: never) => void, reject });
        send({ type: "create", id, live, catchUp });
      });
    },
    processFrame(kind, frame, index, seconds) {
      const id = nextId++;
      const buffer = transferable(frame.data);
      /* oxlint-disable-next-line promise/avoid-new -- bridging a message protocol to a promise */
      return new Promise<FrameOutcome>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (r: never) => void, reject });
        send(
          {
            type: "frame",
            id,
            kind,
            buffer,
            width: frame.width,
            height: frame.height,
            index,
            seconds,
          },
          [buffer],
        );
      });
    },
    readBoard(frame) {
      const id = nextId++;
      const buffer = transferable(frame.data);
      /* oxlint-disable-next-line promise/avoid-new -- bridging a message protocol to a promise */
      return new Promise<BoardCard[]>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (r: never) => void, reject });
        send({ type: "board", id, buffer, width: frame.width, height: frame.height }, [buffer]);
      });
    },
    rearm() {
      send({ type: "rearm" });
    },
    terminate() {
      worker.terminate();
      for (const waiter of pending.values()) {
        waiter.reject(new Error("the scan worker was stopped"));
      }
      pending.clear();
    },
  };
}
