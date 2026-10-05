import type * as BoardModule from "@openrift/shared/scan/board";
import type { BoardCard } from "@openrift/shared/scan/board";
import type * as SessionOptionsModule from "@openrift/shared/scan/session-options";
import type { ScanSessionOptions } from "@openrift/shared/scan/session-options";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ScanWorkerInit,
  ScanWorkerRequest,
  ScanWorkerResponse,
} from "@/features/scan/lib/scan-worker-protocol";

const loadScanBank = vi.fn();
const loadCardDetector = vi.fn();
const loadBoardDetector = vi.fn();
const loadScanEmbedder = vi.fn();
const createConfiguredScanSession = vi.fn();
const readBoard = vi.fn();

vi.mock("@/features/scan/lib/scan-bank", () => ({ loadScanBank }));
vi.mock("@/features/scan/lib/scan-detector", () => ({ loadCardDetector, loadBoardDetector }));
vi.mock("@/features/scan/lib/scan-embedder", () => ({
  loadScanEmbedder,
  embedderImageSize: () => 224,
  embedderThreads: () => 2,
  measuredEmbedMsPerImage: () => 40,
}));
vi.mock("@/features/scan/lib/scan-reference-image", () => ({ fetchReference: vi.fn() }));
vi.mock("@/features/scan/lib/scan-session", () => ({ createConfiguredScanSession }));
vi.mock("@openrift/shared/scan/session-options", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionOptionsModule>()),
  gatesForBank: () => ({ confidentDistance: 0.3, rotationFallbackDistance: 0.45 }),
}));
vi.mock("@openrift/shared/scan/board", async (importOriginal) => ({
  ...(await importOriginal<typeof BoardModule>()),
  readBoard,
}));

const PLAN: Partial<ScanSessionOptions> = {
  candidatesToTry: 4,
  confidentDistance: 0.3,
  rotationFallbackDistance: 0.45,
  topK: 4,
  rotationPairOnly: true,
  accept: { lockRun: 3, maxGapFrames: 2 },
};

const INIT: ScanWorkerInit = {
  type: "init",
  encoderUrl: "/media/scan/encoder.onnx",
  bankUrl: "/media/scan/bank.bin",
  labelsUrl: "/media/scan/labels.json",
  detectorUrl: "/media/scan/detector.onnx",
  boardDetectorUrl: "/media/scan/board.onnx",
  wasmPaths: { wasm: "/assets/ort.wasm" },
};

let listener: ((event: { data: ScanWorkerRequest }) => void) | null = null;
const posted: ScanWorkerResponse[] = [];
let nowMs = 0;

function session() {
  return {
    processFrame: vi.fn(() => Promise.resolve({ winnerRun: null })),
    rearm: vi.fn(),
  };
}

async function flush(): Promise<void> {
  for (let hop = 0; hop < 5; hop++) {
    // oxlint-disable-next-line promise/avoid-new -- awaiting a macrotask boundary
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

async function send(request: ScanWorkerRequest): Promise<void> {
  listener?.({ data: request });
  await flush();
}

function still(id: number): ScanWorkerRequest {
  return { type: "board", id, buffer: new ArrayBuffer(16), width: 2, height: 2 };
}

function frame(id: number): ScanWorkerRequest {
  return {
    type: "frame",
    id,
    kind: "live",
    buffer: new ArrayBuffer(16),
    width: 2,
    height: 2,
    index: id,
    seconds: 0,
  };
}

beforeEach(async () => {
  vi.resetModules();
  posted.length = 0;
  listener = null;
  nowMs = 100_000;
  vi.spyOn(Date, "now").mockImplementation(() => nowMs);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  loadScanBank.mockReset().mockResolvedValue({
    bank: { keys: ["k-a", "k-b"], vectors: new Float32Array(0) },
    artKeys: new Map([
      ["k-a", "art-a"],
      ["k-b", "art-a"],
    ]),
    labels: {},
    bytes: 4096,
    canonical: true,
  });
  loadCardDetector.mockReset().mockResolvedValue(() => Promise.resolve([]));
  loadBoardDetector.mockReset().mockResolvedValue(() => Promise.resolve([]));
  loadScanEmbedder.mockReset().mockResolvedValue(() => Promise.resolve(new Float32Array(0)));
  createConfiguredScanSession.mockReset().mockImplementation(session);
  readBoard.mockReset().mockResolvedValue([]);
  vi.stubGlobal("addEventListener", (_type: string, next: typeof listener) => {
    listener = next;
  });
  vi.stubGlobal("postMessage", (message: ScanWorkerResponse) => {
    posted.push(message);
  });
  await import("./scan-worker");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("init", () => {
  it("reports the loaded engine's measurements and the decoded bank", async () => {
    await send(INIT);

    expect(posted).toContainEqual({
      type: "ready",
      embedMsPerImage: 40,
      embedImageSize: 224,
      threads: 2,
      keys: ["k-a", "k-b"],
      artKeys: [
        ["k-a", "art-a"],
        ["k-b", "art-a"],
      ],
      canonical: true,
      bytes: 4096,
      gates: { confidentDistance: 0.3, rotationFallbackDistance: 0.45 },
    });
  });

  it("passes the page's thread request to the encoder", async () => {
    await send({ ...INIT, ortThreads: 3 });

    expect(loadScanEmbedder).toHaveBeenCalledWith(
      "/media/scan/encoder.onnx",
      { wasm: "/assets/ort.wasm" },
      expect.any(Function),
      3,
    );
  });

  it("fails with code detector when the card detector does not load", async () => {
    loadCardDetector.mockRejectedValue(new Error("bad model"));

    await send(INIT);

    expect(posted).toEqual([
      { type: "error", message: "the card detector did not load", code: "detector" },
    ]);
  });
});

describe("frames", () => {
  it("answers a frame before create with code loading", async () => {
    await send(INIT);
    posted.length = 0;

    await send(frame(1));

    expect(posted).toEqual([{ type: "error", id: 1, message: "no session", code: "loading" }]);
  });

  it("confirms create once both sessions exist", async () => {
    await send(INIT);
    posted.length = 0;

    await send({ type: "create", id: 9, live: PLAN, catchUp: PLAN });

    expect(createConfiguredScanSession).toHaveBeenCalledTimes(2);
    expect(posted).toEqual([{ type: "created", id: 9 }]);
  });

  it("refuses create before init with code loading", async () => {
    await send({ type: "create", id: 9, live: PLAN, catchUp: PLAN });

    expect(posted).toEqual([
      { type: "error", id: 9, message: "the engine is still loading", code: "loading" },
    ]);
  });

  it("names the create that failed to build the sessions", async () => {
    await send(INIT);
    posted.length = 0;
    createConfiguredScanSession.mockImplementationOnce(() => {
      throw new Error("bad plan");
    });

    await send({ type: "create", id: 9, live: PLAN, catchUp: PLAN });

    expect(posted).toEqual([{ type: "error", id: 9, message: "bad plan" }]);
  });

  it("runs a frame through the live session after create", async () => {
    await send(INIT);
    await send({ type: "create", id: 9, live: PLAN, catchUp: PLAN });
    posted.length = 0;

    await send(frame(1));

    expect(posted).toEqual([{ type: "outcome", id: 1, outcome: { winnerRun: null } }]);
  });

  it("rearms only the live session", async () => {
    await send(INIT);
    await send({ type: "create", id: 9, live: PLAN, catchUp: PLAN });
    const [live, catchUp] = createConfiguredScanSession.mock.results.map(
      (result) => result.value as ReturnType<typeof session>,
    );

    await send({ type: "rearm" });

    expect(live!.rearm).toHaveBeenCalledOnce();
    expect(catchUp!.rearm).not.toHaveBeenCalled();
  });
});

describe("board reads", () => {
  it("returns no cards while the board detector loads", async () => {
    // oxlint-disable-next-line promise/avoid-new -- a board detector that never finishes loading
    loadBoardDetector.mockReturnValue(new Promise(() => {}));
    await send(INIT);
    posted.length = 0;

    await send(still(7));

    expect(readBoard).not.toHaveBeenCalled();
    expect(posted).toEqual([{ type: "board", id: 7, cards: [] }]);
  });

  it("retries a board detector that failed to load only after thirty seconds", async () => {
    loadBoardDetector.mockRejectedValue(new Error("offline"));
    await send(INIT);
    expect(loadBoardDetector).toHaveBeenCalledTimes(1);

    await send(still(1));
    expect(loadBoardDetector).toHaveBeenCalledTimes(1);

    nowMs += 30_000;
    await send(still(2));
    expect(loadBoardDetector).toHaveBeenCalledTimes(2);
  });

  it("reads a board with the bank's gates and canonical rotation pairing", async () => {
    const card = { key: "k-a", artKey: "art-a" } as BoardCard;
    readBoard.mockResolvedValue([card]);
    await send(INIT);
    posted.length = 0;

    await send(still(3));

    expect(readBoard).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ embedImageSize: 224 }),
      expect.objectContaining({
        topK: 3,
        confidentDistance: 0.3,
        rotationFallbackDistance: 0.45,
        rotationPairOnly: true,
      }),
    );
    expect(posted).toEqual([{ type: "board", id: 3, cards: [card] }]);
  });

  it("reads no board without a board detector", async () => {
    await send({ ...INIT, boardDetectorUrl: null });
    posted.length = 0;

    await send(still(3));

    expect(readBoard).not.toHaveBeenCalled();
    expect(posted).toEqual([{ type: "board", id: 3, cards: [] }]);
  });
});
