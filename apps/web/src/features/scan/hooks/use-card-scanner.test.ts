import { DEFAULT_ALIGNED_OPTIONS } from "@openrift/shared/scan/accept";
import type * as AlignedVerifyModule from "@openrift/shared/scan/aligned-verify";
import type { BoardCard } from "@openrift/shared/scan/board";
import type { CardEmbedder, EmbedBank } from "@openrift/shared/scan/embed";
import { EMBED_IMAGE_SIZE } from "@openrift/shared/scan/embed";
import type { CardLabels } from "@openrift/shared/scan/labels";
import { DEFAULT_PLACEMENT_OPTIONS, PLACEMENT_HOLD_SECONDS } from "@openrift/shared/scan/placement";
import type { ScanSession } from "@openrift/shared/scan/session";
import type { ScanSessionOptions } from "@openrift/shared/scan/session-options";
import { centeredGuideQuad, gatesForEmbedDim } from "@openrift/shared/scan/session-options";
import type { CardCandidate, RgbaImage } from "@openrift/shared/scan/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as CameraInfoModule from "@/features/scan/lib/camera-info";
import type { CameraInfo } from "@/features/scan/lib/camera-info";
import { readCameraInfo } from "@/features/scan/lib/camera-info";
import type { LoadedScanBank } from "@/features/scan/lib/scan-bank";
import type { IdentifyAttempt } from "@/features/scan/lib/scan-catchup";
import type { BoardReadCard, LockedCard } from "@/features/scan/lib/scan-locks";
import { GUIDE_COLOR, RETICLE_COLOR } from "@/features/scan/lib/scan-overlay";
import { PAUSED_POLL_MS } from "@/features/scan/lib/scan-pacing";
import { fetchReference } from "@/features/scan/lib/scan-reference-image";
import type { ScannerSettings } from "@/features/scan/lib/scan-session";
import {
  DEFAULT_SCANNER_SETTINGS,
  createConfiguredScanSession,
} from "@/features/scan/lib/scan-session";
import type { ScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import { createScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import type {
  DownloadPart,
  ScanWorkerReady,
  SessionKind,
} from "@/features/scan/lib/scan-worker-protocol";

import { useCardScanner } from "./use-card-scanner";
import { useScanEngine } from "./use-scan-engine";

vi.mock("@/features/scan/lib/scan-worker-client", () => ({
  createScanWorkerClient: vi.fn(),
}));

vi.mock("@openrift/shared/scan/aligned-verify", async (importOriginal) => ({
  ...(await importOriginal<typeof AlignedVerifyModule>()),
  createAlignedVerifier: (): AlignedVerifyModule.AlignedVerifier => (_card, shortlist) =>
    Promise.resolve({
      scores: shortlist.map(({ key }) => ({ key, score: currentScore(key) })),
      failed: [],
    }),
}));

vi.mock("@/features/scan/lib/scan-reference-image", () => ({
  fetchReference: vi.fn(),
}));

vi.mock("@/features/scan/lib/camera-info", async (importOriginal) => {
  const actual = await importOriginal<typeof CameraInfoModule>();
  return {
    ...actual,
    readCameraInfo: vi.fn(),
  };
});

function referenceImage(): RgbaImage {
  const data = new Uint8ClampedArray(8 * 11 * 4);
  data.fill(200);
  return { data, width: 8, height: 11 };
}

function createBank(distances: Record<string, number>): EmbedBank {
  const bank: EmbedBank = { keys: Object.keys(distances), vectors: new Float32Array(0) };
  bank.vectors = new Float32Array(bank.keys.length * 2);
  setDistances(bank, distances);
  return bank;
}

/** Rewrites a bank's distances in place, so a running session sees the change on its next frame. */
function setDistances(bank: EmbedBank, distances: Record<string, number>): void {
  bank.keys.forEach((key, index) => {
    const cosine = 1 - (distances[key] ?? 2);
    bank.vectors[index * 2] = cosine;
    bank.vectors[index * 2 + 1] = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  });
}

/** When set, every embed call rejects with this message. */
let embedFailure: string | null = null;

function createEmbedder(): CardEmbedder {
  return (_pixels, count) => {
    if (embedFailure !== null) {
      return Promise.reject(new Error(embedFailure));
    }
    const out = new Float32Array(count * 2);
    for (let slot = 0; slot < count; slot++) {
      out[slot * 2] = 1;
    }
    return Promise.resolve(out);
  };
}

/** Callbacks parked until the test pumps them, so loops advance on demand. */
let rafQueue: FrameRequestCallback[] = [];
let pumps = 0;

function pumpAnimationFrames(): void {
  pumps++;
  const callbacks = rafQueue;
  rafQueue = [];
  for (const callback of callbacks) {
    callback(nowMs);
  }
}

/** The spied `performance.now` clock, advanced explicitly per frame. */
let nowMs = 0;

function advance(ms: number): void {
  nowMs += ms;
}

/** Per-call scene identity: bump to make the fake camera show a new scene. */
let sceneSeed = 0;

/**
 * Noise sharp enough for the real `MIN_FOCUS` gate; the same size and seed
 * give the same pixels, so consecutive frames read as a static scene.
 */
function scenePixels(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  let state = 1_234_567 + sceneSeed * 7919;
  for (let index = 0; index < data.length; index += 4) {
    state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    const value = state % 256;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  return data;
}

const fakeContexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
const strokes: { canvas: HTMLCanvasElement; style: string; dash: number[] }[] = [];

/** Solid strokes only: the lock ring is dashed, the brackets are not. */
function solidStrokeStyles(canvas: HTMLCanvasElement): string[] {
  return strokes
    .filter((stroke) => stroke.canvas === canvas && stroke.dash.length === 0)
    .map((stroke) => stroke.style);
}

/**
 * A permissive fake 2d context: known reads are answered, everything else is
 * a cached no-op; `getImageData` serves the current fake scene.
 */
function fakeContextFor(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const existing = fakeContexts.get(canvas);
  if (existing) {
    return existing;
  }
  let dash: number[] = [];
  const backing: Record<string | symbol, unknown> = {
    canvas,
    setLineDash: (next: number[]) => {
      dash = next;
    },
    stroke: () => {
      const style = backing.strokeStyle;
      strokes.push({ canvas, style: typeof style === "string" ? style : "", dash: [...dash] });
    },
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: scenePixels(width, height),
      width,
      height,
    }),
    measureText: () => ({ width: 0 }),
  };
  const context = new Proxy(backing, {
    get(target, property) {
      if (!(property in target)) {
        target[property] = () => {};
      }
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  fakeContexts.set(canvas, context);
  return context;
}

interface FakeStream {
  stream: MediaStream;
  tracks: { stop: ReturnType<typeof vi.fn> }[];
}

function createFakeStream(): FakeStream {
  const tracks = [{ stop: vi.fn() }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
}

function stubGetUserMedia(
  implementation: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): ReturnType<typeof vi.fn> {
  const getUserMedia = vi.fn(implementation);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
  return getUserMedia;
}

/** Fixed dimensions and a writable `srcObject`; jsdom's video element supports neither natively. */
function createFakeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
  Object.defineProperty(video, "srcObject", { value: null, writable: true, configurable: true });
  video.play = vi.fn(() => Promise.resolve());
  return video;
}

/**
 * One macrotask hop, which flushes every pending microtask that the frame
 * pipeline's internal awaits need to run to completion.
 */
function flushAsync(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping the setTimeout callback API to await a macrotask boundary
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  // oxlint-disable-next-line promise/avoid-new, promise/param-names -- a hand-rolled deferred exists to expose the executor's settle functions
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FAKE_CAMERA_INFO: CameraInfo = {
  devices: [],
  label: "Fake rear camera",
  settings: [],
  capabilities: [],
  capabilitiesSupported: false,
};

/** 0..1 */
let currentScore: (key: string) => number = () => 0;
let bankState: EmbedBank;
let workerInit: () => Promise<ScanWorkerReady>;
let onStand = false;
let sweeping = false;
let surveyOutlines: CardCandidate[] | null;
let readBoardCards: () => Promise<BoardCard[]>;
let createFailure: string | null = null;
let frameGate: Promise<void> | null = null;
let createGate: Promise<void> | null = null;
let bankUrl = "https://assets.invalid/bank.bin";
const liveFrames: number[] = [];
const livePlans: Partial<ScanSessionOptions>[] = [];

const LABELS: CardLabels = {
  "k-a": { name: "Lux", code: "OGN-001", language: "en" },
  "k-b": { name: "Garen", code: "OGN-002", language: "en" },
};

const READY: ScanWorkerReady = {
  embedMsPerImage: 80,
  embedImageSize: EMBED_IMAGE_SIZE,
  threads: 1,
  keys: ["k-a", "k-b"],
  artKeys: [
    ["k-a", "art-a"],
    ["k-b", "art-b"],
  ],
  canonical: true,
  bytes: 1024,
  gates: gatesForEmbedDim(2),
};

function loadedBank(): LoadedScanBank {
  return {
    bank: bankState,
    artKeys: new Map(READY.artKeys),
    labels: LABELS,
    bytes: READY.bytes,
    canonical: true,
  };
}

function createInThreadClient(
  onProgress?: (part: DownloadPart, loaded: number, total: number) => void,
) {
  const sessions = new Map<SessionKind, ScanSession>();
  let boardDetector = false;
  const client: ScanWorkerClient = {
    init: (assets) => {
      boardDetector = assets.boardDetectorUrl !== null;
      onProgress?.("encoder", 10, 20);
      return workerInit();
    },
    create: async (live, catchUp) => {
      if (createGate) {
        await createGate;
      }
      if (createFailure !== null) {
        throw new Error(createFailure);
      }
      livePlans.push(live);
      const engine = {
        embedder: createEmbedder(),
        embedImageSize: EMBED_IMAGE_SIZE,
        detectCard: () => Promise.resolve([]),
        detectBoard: () => Promise.resolve([]),
      };
      sessions.set("live", createConfiguredScanSession(engine, loadedBank(), live));
      sessions.set("catchUp", createConfiguredScanSession(engine, loadedBank(), catchUp));
    },
    processFrame: async (kind, frame, index, seconds) => {
      const session = sessions.get(kind);
      const gate = frameGate;
      frameGate = null;
      if (gate) {
        await gate;
      }
      if (!session) {
        throw new Error("no session");
      }
      const processed = await session.processFrame(frame, index, seconds, () => performance.now());
      if (kind === "live") {
        liveFrames.push(index);
      }
      const outcome =
        kind === "live"
          ? {
              ...processed,
              still: onStand || processed.still,
              sweeping: sweeping || processed.sweeping,
              ...(surveyOutlines ? { survey: boardDetector ? surveyOutlines : [] } : {}),
            }
          : processed;
      return outcome;
    },
    readBoard: () => readBoardCards(),
    rearm: () => {
      sessions.get("live")?.rearm();
    },
    terminate: () => {},
  };
  return client;
}

function cardPresent(): void {
  setDistances(bankState, { "k-a": 0.05, "k-b": 0.9 });
  currentScore = (key) => (key === "k-a" ? 0.9 : 0);
}

function cardAtAcceptFloor(): void {
  setDistances(bankState, { "k-a": 0.05, "k-b": 0.9 });
  currentScore = (key) => (key === "k-a" ? DEFAULT_ALIGNED_OPTIONS.minScore : 0);
}

function otherCardPresent(): void {
  setDistances(bankState, { "k-a": 0.9, "k-b": 0.05 });
  currentScore = (key) => (key === "k-b" ? 0.9 : 0);
}

function cardAbsent(): void {
  setDistances(bankState, { "k-a": 0.9, "k-b": 0.9 });
  currentScore = () => 0;
}

/**
 * A second artwork close behind the first: the winner clears the aligned
 * margin but not the catch-up margin, so a lone frame is only offered.
 */
function cardWithCloseRival(): void {
  setDistances(bankState, { "k-a": 0.05, "k-b": 0.06 });
  currentScore = (key) => (key === "k-a" ? 0.7 : 0.5);
}

interface MountOptions {
  settings?: ScannerSettings;
  labels?: CardLabels | null;
  boardDetector?: boolean;
}

async function mountScanner(options: MountOptions = {}) {
  const onLock = vi.fn<(lock: LockedCard) => void>();
  const onBoardRead = vi.fn<(cards: BoardReadCard[]) => void>();
  const hook = renderHook(
    ({ settings }: { settings: ScannerSettings }) => {
      const engine = useScanEngine(
        {
          encoderUrl: "https://assets.invalid/encoder.onnx",
          bankUrl,
          labelsUrl: "https://assets.invalid/labels.json",
          detectorUrl: "https://assets.invalid/detector.onnx",
          boardDetectorUrl: options.boardDetector ? "https://assets.invalid/board.onnx" : null,
        },
        options.labels === undefined ? LABELS : options.labels,
      );
      const scanner = useCardScanner(engine, settings, { onLock, onBoardRead });
      return { ...scanner, engine };
    },
    { initialProps: { settings: options.settings ?? DEFAULT_SCANNER_SETTINGS } },
  );
  const video = createFakeVideo();
  const overlay = document.createElement("canvas");
  hook.result.current.videoRef.current = video;
  hook.result.current.overlayRef.current = overlay;
  return { hook, video, overlay, onLock, onBoardRead };
}

async function mountReadyScanner(options: MountOptions = {}) {
  const mounted = await mountScanner(options);
  await waitFor(() => {
    expect(mounted.hook.result.current.engine.engineReady).toBe(true);
  });
  return mounted;
}

/**
 * Pumps `count` frame iterations, advancing the clock past the publish
 * throttle each time so every processed frame reaches the readout.
 */
async function runFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame++) {
    advance(200);
    await act(async () => {
      pumpAnimationFrames();
      await flushAsync();
      await flushAsync();
    });
  }
}

const CAMERA_TICK_MS = 100;

/**
 * One camera-rate tick: watcher, painter and frame loop run once each. The
 * short clock step keeps a disturbance trusted between ticks.
 */
async function pumpCameraFrame(): Promise<void> {
  advance(CAMERA_TICK_MS);
  await act(async () => {
    pumpAnimationFrames();
    await flushAsync();
    await flushAsync();
  });
}

async function pumpCameraFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame++) {
    await pumpCameraFrame();
  }
}

async function changeScene(seeds: readonly number[]): Promise<void> {
  for (const seed of seeds) {
    sceneSeed = seed;
    await pumpCameraFrame();
  }
}

async function holdStill(): Promise<void> {
  await pumpCameraFrames(
    DEFAULT_PLACEMENT_OPTIONS.settleFrames +
      Math.ceil((PLACEMENT_HOLD_SECONDS * 1000) / CAMERA_TICK_MS),
  );
}

/**
 * Deals an unrecognised card and waits out the miss grace window; the next
 * tick books the miss and frees the catch-up slot.
 */
async function landUnrecognisedCard(): Promise<void> {
  await pumpCameraFrame();
  await changeScene([1, 2, 3]);
  await holdStill();
  advance(4100);
}

/** A copy dealt onto the pile: the scene changes for a few frames, then holds still. */
async function dealAnotherCopy(): Promise<void> {
  await changeScene([11, 12, 13]);
  await holdStill();
}

describe("useCardScanner", () => {
  beforeEach(() => {
    nowMs = 10_000;
    sceneSeed = 0;
    rafQueue = [];
    strokes.length = 0;
    bankState = createBank({ "k-a": 0.9, "k-b": 0.9 });
    currentScore = () => 0;
    embedFailure = null;
    workerInit = () => Promise.resolve(READY);

    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    // The per-frame [scan] diagnostics would drown the test output.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function fakeGetContext(
      this: HTMLCanvasElement,
    ) {
      return fakeContextFor(this);
    } as unknown as typeof HTMLCanvasElement.prototype.getContext);
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,fake";

    vi.stubGlobal("Worker", vi.fn());
    vi.mocked(createScanWorkerClient).mockImplementation(createInThreadClient);
    vi.mocked(fetchReference).mockImplementation(() => Promise.resolve(referenceImage()));
    surveyOutlines = null;
    readBoardCards = () => Promise.resolve([]);
    liveFrames.length = 0;
    livePlans.length = 0;
    createFailure = null;
    frameGate = null;
    createGate = null;
    bankUrl = "https://assets.invalid/bank.bin";
    vi.mocked(readCameraInfo).mockResolvedValue(FAKE_CAMERA_INFO);
    stubGetUserMedia(() => Promise.resolve(createFakeStream().stream));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    rafQueue = [];
    onStand = false;
    sweeping = false;
  });

  describe("engine loading", () => {
    it("reports download progress and readiness", async () => {
      const { hook } = await mountReadyScanner();

      expect(hook.result.current.engine.progress).toEqual({
        encoder: { loaded: 10, total: 20, ready: true },
        bank: { loaded: 0, total: 0, ready: true },
      });
      expect(hook.result.current.engine.embedMsPerImage).toBe(80);
      expect(hook.result.current.engine.slowDevice).toBe(false);
      expect(hook.result.current.error).toBeNull();
    });

    it("surfaces a failed engine load as the hook error", async () => {
      workerInit = () => Promise.reject(new Error("Could not load the card detector"));

      const { hook } = await mountScanner();

      await waitFor(() => {
        expect(hook.result.current.error).toBe("Could not load the card detector");
      });
      expect(hook.result.current.engine.engineReady).toBe(false);
    });

    it("explains that a browser without workers cannot scan", async () => {
      vi.stubGlobal("Worker", undefined);

      const { hook } = await mountScanner();

      await waitFor(() => {
        expect(hook.result.current.error).toBe(
          "This browser cannot run the scanner. Update it or try another browser.",
        );
      });
      expect(createScanWorkerClient).not.toHaveBeenCalled();
    });

    it("flags a device whose measured encoder cost crosses the slow floor", async () => {
      workerInit = () => Promise.resolve({ ...READY, embedMsPerImage: 300 });

      const { hook } = await mountReadyScanner();

      expect(hook.result.current.engine.embedMsPerImage).toBe(300);
      expect(hook.result.current.engine.slowDevice).toBe(true);
    });
  });

  describe("start and stop", () => {
    it("opens the camera, attaches the stream and flips active; stop reverses all of it", async () => {
      const fake = createFakeStream();
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(fake.stream));
      const { hook, video } = await mountReadyScanner();

      await act(async () => {
        await hook.result.current.start();
      });

      expect(getUserMedia).toHaveBeenCalledTimes(1);
      // A fast device gets no frame rate cap.
      expect(getUserMedia.mock.calls[0]![0]).toEqual({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      expect(video.play).toHaveBeenCalledTimes(1);
      expect(video.srcObject).toBe(fake.stream);
      expect(hook.result.current.active).toBe(true);
      expect(hook.result.current.error).toBeNull();

      act(() => {
        hook.result.current.stop();
      });

      expect(hook.result.current.active).toBe(false);
      expect(fake.tracks[0]!.stop).toHaveBeenCalled();
      expect(video.srcObject).toBeNull();
    });

    it("refuses to start before the engine is ready, without touching the camera", async () => {
      // oxlint-disable-next-line promise/avoid-new -- deliberately never-settling load to hold the engine in its loading state
      workerInit = () => new Promise(() => {});
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(createFakeStream().stream));
      const { hook } = await mountScanner();

      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.error).toBe("The engine is still loading, try again in a moment.");
      expect(hook.result.current.active).toBe(false);
      expect(getUserMedia).not.toHaveBeenCalled();
    });

    it("refuses to start while the card labels have not loaded", async () => {
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(createFakeStream().stream));
      const { hook } = await mountReadyScanner({ labels: null });

      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.error).toBe("The engine is still loading, try again in a moment.");
      expect(getUserMedia).not.toHaveBeenCalled();
    });

    it("maps a denied camera to the user-facing message and allows a retry", async () => {
      const getUserMedia = stubGetUserMedia(() =>
        Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
      );
      const { hook } = await mountReadyScanner();

      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.error).toBe(
        "Camera access was blocked. Allow camera access for this site in your browser settings and try again.",
      );
      expect(hook.result.current.active).toBe(false);

      getUserMedia.mockImplementation(() => Promise.resolve(createFakeStream().stream));
      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.active).toBe(true);
      expect(hook.result.current.error).toBeNull();
    });

    it("retries without the frame rate cap when a slow device's capped request is overconstrained", async () => {
      workerInit = () => Promise.resolve({ ...READY, embedMsPerImage: 300 });
      const fake = createFakeStream();
      const getUserMedia = stubGetUserMedia(
        vi
          .fn()
          .mockRejectedValueOnce(new DOMException("no mode fits", "OverconstrainedError"))
          .mockResolvedValueOnce(fake.stream),
      );
      const { hook } = await mountReadyScanner();

      await act(async () => {
        await hook.result.current.start();
      });

      expect(getUserMedia).toHaveBeenCalledTimes(2);
      const first = getUserMedia.mock.calls[0]![0] as { video: MediaTrackConstraints };
      const second = getUserMedia.mock.calls[1]![0] as { video: MediaTrackConstraints };
      expect(first.video.frameRate).toEqual({ max: 30 });
      expect(second.video.frameRate).toBeUndefined();
      expect(hook.result.current.active).toBe(true);
    });

    it("stops the opened tracks when the preview refuses to play", async () => {
      const fake = createFakeStream();
      stubGetUserMedia(() => Promise.resolve(fake.stream));
      const { hook, video } = await mountReadyScanner();
      video.play = vi.fn(() => Promise.reject(new Error("autoplay blocked")));

      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.error).toBe("autoplay blocked");
      expect(hook.result.current.active).toBe(false);
      expect(fake.tracks[0]!.stop).toHaveBeenCalled();
    });

    it("reports a start whose sessions cannot be built and lets Start run again", async () => {
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(createFakeStream().stream));
      const { hook } = await mountReadyScanner();
      createFailure = "the session plan was refused";

      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.error).toBe("the session plan was refused");
      expect(hook.result.current.active).toBe(false);
      expect(getUserMedia).not.toHaveBeenCalled();

      createFailure = null;
      await act(async () => {
        await hook.result.current.start();
      });

      expect(hook.result.current.active).toBe(true);
      expect(hook.result.current.error).toBeNull();
    });

    it("opens the camera once for two overlapping start calls", async () => {
      const opened = deferred<MediaStream>();
      const getUserMedia = stubGetUserMedia(() => opened.promise);
      const { hook } = await mountReadyScanner();

      let firstStart!: Promise<void>;
      let secondStart!: Promise<void>;
      act(() => {
        firstStart = hook.result.current.start();
        secondStart = hook.result.current.start();
      });
      opened.resolve(createFakeStream().stream);
      await act(async () => {
        await Promise.all([firstStart, secondStart]);
      });

      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(hook.result.current.active).toBe(true);
    });

    it("shuts a stream opened after stop bumped the run generation", async () => {
      const opened = deferred<MediaStream>();
      const getUserMedia = stubGetUserMedia(() => opened.promise);
      const fake = createFakeStream();
      const { hook, video } = await mountReadyScanner();

      let startPromise!: Promise<void>;
      act(() => {
        startPromise = hook.result.current.start();
      });
      await waitFor(() => {
        expect(getUserMedia).toHaveBeenCalled();
      });
      act(() => {
        hook.result.current.stop();
      });
      opened.resolve(fake.stream);
      await act(async () => {
        await startPromise;
      });

      expect(fake.tracks[0]!.stop).toHaveBeenCalled();
      expect(hook.result.current.active).toBe(false);
      expect(video.srcObject).toBeNull();
      expect(video.play).not.toHaveBeenCalled();
    });

    it("shuts a stream opened after the page unmounted mid-start", async () => {
      const opened = deferred<MediaStream>();
      const getUserMedia = stubGetUserMedia(() => opened.promise);
      const fake = createFakeStream();
      const { hook } = await mountReadyScanner();

      let startPromise!: Promise<void>;
      act(() => {
        startPromise = hook.result.current.start();
      });
      await waitFor(() => {
        expect(getUserMedia).toHaveBeenCalled();
      });
      hook.unmount();
      opened.resolve(fake.stream);
      await act(async () => {
        await startPromise;
      });

      expect(fake.tracks[0]!.stop).toHaveBeenCalled();
    });

    it("never asks for the camera when the page unmounts while the sessions are built", async () => {
      const built = deferred<undefined>();
      createGate = built.promise;
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(createFakeStream().stream));
      const { hook } = await mountReadyScanner();

      let startPromise!: Promise<void>;
      act(() => {
        startPromise = hook.result.current.start();
      });
      await act(async () => {
        await flushAsync();
      });
      hook.unmount();
      built.resolve(undefined);
      await act(async () => {
        await startPromise;
      });

      expect(getUserMedia).not.toHaveBeenCalled();
    });

    it("rebuilds the sessions and keeps scanning when the bank is reloaded mid-run", async () => {
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(2);
      const settings = DEFAULT_SCANNER_SETTINGS;

      bankUrl = "https://assets.invalid/bank-v2.bin";
      hook.rerender({ settings });
      await waitFor(() => {
        expect(livePlans).toHaveLength(2);
      });
      const framesBefore = liveFrames.length;
      await runFrames(2);

      expect(liveFrames.length).toBeGreaterThan(framesBefore);
      expect(hook.result.current.error).toBeNull();
      expect(hook.result.current.active).toBe(true);
    });

    it("keeps the camera report readable after stop", async () => {
      const { hook } = await mountReadyScanner();

      await act(async () => {
        await hook.result.current.start();
      });
      await act(async () => {
        await flushAsync();
      });
      act(() => {
        hook.result.current.stop();
      });

      expect(hook.result.current.cameraInfo).toEqual(FAKE_CAMERA_INFO);
    });
  });

  describe("frame loop and readout", () => {
    it("publishes a readout for winner-less frames over an empty guide", async () => {
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(2);

      const readout = hook.result.current.readout;
      expect(readout.fps).toBeGreaterThan(0);
      expect(readout.winnerKey).toBeNull();
      // An empty guide's far-ranked junk must not present as aiming at a card.
      expect(readout.aim).toBeNull();
      expect(readout.locks).toEqual([]);
      // The guide session always proposes the guide rect itself.
      expect(readout.candidate).not.toBeNull();
    });

    it("brackets the card only once a frame verifies it", async () => {
      cardAbsent();
      const { hook, overlay } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(2);

      // The guide session proposes the guide rect on every empty frame; that
      // proposal is not evidence of a card and must not draw brackets.
      expect(new Set(solidStrokeStyles(overlay))).toEqual(new Set([GUIDE_COLOR]));

      cardPresent();
      await runFrames(2);

      expect(solidStrokeStyles(overlay)).toContain(RETICLE_COLOR);
    });

    it("locks a recognised card, reports it and publishes the lock", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(6);

      expect(onLock).toHaveBeenCalledTimes(1);
      const lock = onLock.mock.calls[0]![0];
      expect(lock.key).toBe("k-a");
      expect(lock.artKey).toBe("art-a");
      expect(lock.label).toBe("Lux (OGN-001 en)");
      // A single-render artwork gives the disambiguation stage nothing to run
      // on, so the lock reports unresolved.
      expect(lock.resolved).toBe(false);
      const readout = hook.result.current.readout;
      expect(readout.locks).toHaveLength(1);
      expect(readout.locks[0]!.key).toBe("k-a");
      expect(readout.winnerKey).toBe("k-a");
      expect(readout.aim?.artKey).toBe("art-a");
      expect(readout.candidateAreaFraction).toBeGreaterThan(0.5);
    });

    it("drops a frame that was in flight when stop bumped the generation", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      advance(200);
      await act(async () => {
        pumpAnimationFrames();
        hook.result.current.stop();
        await flushAsync();
        await flushAsync();
      });

      expect(hook.result.current.readout.fps).toBe(0);
      expect(hook.result.current.readout.winnerKey).toBeNull();
      expect(onLock).not.toHaveBeenCalled();
    });

    it("reports a failed frame and keeps the loop alive", async () => {
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      embedFailure = "encoder backend crashed";
      await runFrames(1);

      expect(hook.result.current.error).toBe("encoder backend crashed");

      embedFailure = null;
      await runFrames(2);

      expect(hook.result.current.readout.fps).toBeGreaterThan(0);
    });

    it("runs one frame loop after a stop and start inside the paused poll", async () => {
      cardAbsent();
      const paused: ScannerSettings = { ...DEFAULT_SCANNER_SETTINGS, paused: true };
      const { hook } = await mountReadyScanner({ settings: paused });
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);

      await act(async () => {
        hook.result.current.stop();
        await hook.result.current.start();
      });
      await runFrames(1);
      await act(async () => {
        hook.rerender({ settings: DEFAULT_SCANNER_SETTINGS });
        // oxlint-disable-next-line promise/avoid-new -- lets both paused polls fire on the real clock
        await new Promise((resolve) => {
          setTimeout(resolve, PAUSED_POLL_MS + 50);
        });
      });

      const framesBefore = liveFrames.length;
      await runFrames(1);

      expect(liveFrames.length - framesBefore).toBe(1);
    });

    it("clears locks and the readout on clearHistory", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(6);
      expect(onLock).toHaveBeenCalled();

      act(() => {
        hook.result.current.clearHistory();
      });

      expect(hook.result.current.readout.locks).toEqual([]);
      expect(hook.result.current.readout.winnerKey).toBeNull();
      expect(hook.result.current.readout.fps).toBe(0);
    });
  });

  describe("capture mode", () => {
    const captureSettings: ScannerSettings = { ...DEFAULT_SCANNER_SETTINGS, mode: "capture" };

    it("keeps the pipeline idle until a tap, then locks on one verified frame", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner({ settings: captureSettings });
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(3);
      expect(hook.result.current.readout.fps).toBe(0);
      expect(onLock).not.toHaveBeenCalled();

      advance(200);
      await act(async () => {
        await hook.result.current.capture();
      });

      expect(onLock).toHaveBeenCalledTimes(1);
      expect(hook.result.current.readout.winnerKey).toBe("k-a");
      // A tapped lock times just the single tap's processing.
      expect(onLock.mock.calls[0]![0].framesToLock).toBe(1);
    });

    it("ignores a second tap while the first is still processing", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner({ settings: captureSettings });
      await act(async () => {
        await hook.result.current.start();
      });

      advance(200);
      let firstTap!: Promise<void>;
      let secondTap!: Promise<void>;
      act(() => {
        firstTap = hook.result.current.capture();
        secondTap = hook.result.current.capture();
      });
      await act(async () => {
        await Promise.all([firstTap, secondTap]);
        await flushAsync();
      });

      expect(onLock).toHaveBeenCalledTimes(1);
    });
  });

  describe("switching Tap to scan while the camera runs", () => {
    const captureSettings: ScannerSettings = { ...DEFAULT_SCANNER_SETTINGS, mode: "capture" };

    async function switchTo(
      hook: Awaited<ReturnType<typeof mountReadyScanner>>["hook"],
      settings: ScannerSettings,
    ): Promise<void> {
      await act(async () => {
        hook.rerender({ settings });
        await flushAsync();
        await flushAsync();
      });
    }

    it("stops the frame loop and scans per tap once Tap to scan is turned on", async () => {
      const { stream, tracks } = createFakeStream();
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(stream));
      cardAbsent();
      const { hook, video, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(2);

      await switchTo(hook, captureSettings);
      expect(livePlans).toHaveLength(2);
      expect(livePlans[1]).toMatchObject({ sweep: false, accept: { lockRun: 1 } });
      const framesBefore = liveFrames.length;
      await runFrames(3);
      expect(liveFrames.length).toBe(framesBefore);

      cardPresent();
      advance(200);
      await act(async () => {
        await hook.result.current.capture();
      });

      expect(onLock).toHaveBeenCalledTimes(1);
      expect(onLock.mock.calls[0]![0].framesToLock).toBe(1);
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(tracks[0]!.stop).not.toHaveBeenCalled();
      expect(video.srcObject).toBe(stream);
    });

    async function holdNextFrame(): Promise<ReturnType<typeof deferred<void>>> {
      const held = deferred<void>();
      frameGate = held.promise;
      advance(200);
      await act(async () => {
        pumpAnimationFrames();
        await flushAsync();
      });
      expect(frameGate).toBeNull();
      return held;
    }

    it("switches to Tap to scan once a frame that was in flight fails", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);
      const held = await holdNextFrame();

      await switchTo(hook, captureSettings);
      expect(livePlans).toHaveLength(1);
      await act(async () => {
        held.reject(new Error("encoder backend crashed"));
        await flushAsync();
        await flushAsync();
      });

      expect(livePlans).toHaveLength(2);
      expect(livePlans[1]).toMatchObject({ accept: { lockRun: 1 } });
      cardPresent();
      advance(200);
      await act(async () => {
        await hook.result.current.capture();
      });
      expect(onLock).toHaveBeenCalledTimes(1);
      expect(hook.result.current.active).toBe(true);
    });

    it("ignores a tap while the switch to Tap to scan is still building the sessions", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);
      const held = await holdNextFrame();
      await switchTo(hook, captureSettings);

      cardPresent();
      const framesBefore = liveFrames.length;
      advance(200);
      await act(async () => {
        await hook.result.current.capture();
      });
      expect(liveFrames.length).toBe(framesBefore);

      await act(async () => {
        held.resolve();
        await flushAsync();
        await flushAsync();
      });
      advance(200);
      await act(async () => {
        await hook.result.current.capture();
      });
      expect(onLock).toHaveBeenCalledTimes(1);
      expect(onLock.mock.calls[0]![0].framesToLock).toBe(1);
    });

    it("stops the camera and reports why when a switch cannot build the sessions", async () => {
      const { stream, tracks } = createFakeStream();
      stubGetUserMedia(() => Promise.resolve(stream));
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);

      createFailure = "the session plan was refused";
      await switchTo(hook, captureSettings);

      expect(hook.result.current.error).toBe("the session plan was refused");
      expect(hook.result.current.active).toBe(false);
      expect(tracks[0]!.stop).toHaveBeenCalled();
      const framesBefore = liveFrames.length;
      await runFrames(2);
      expect(liveFrames.length).toBe(framesBefore);

      createFailure = null;
      await act(async () => {
        await hook.result.current.start();
      });
      expect(hook.result.current.active).toBe(true);
    });

    it("runs one frame loop in the final mode after a quick double toggle", async () => {
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);

      hook.rerender({ settings: captureSettings });
      hook.rerender({ settings: DEFAULT_SCANNER_SETTINGS });
      await act(async () => {
        await flushAsync();
        await flushAsync();
      });

      expect(livePlans).toHaveLength(3);
      expect(livePlans.at(-1)).toMatchObject({ sweep: true, accept: { lockRun: 3 } });
      const framesBefore = liveFrames.length;
      await runFrames(1);
      expect(liveFrames.length - framesBefore).toBe(1);
    });

    it("starts the frame loop once Tap to scan is turned off", async () => {
      const { stream, tracks } = createFakeStream();
      const getUserMedia = stubGetUserMedia(() => Promise.resolve(stream));
      cardAbsent();
      const { hook, video, onLock } = await mountReadyScanner({ settings: captureSettings });
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(3);
      expect(liveFrames).toEqual([]);

      await switchTo(hook, DEFAULT_SCANNER_SETTINGS);
      expect(livePlans).toHaveLength(2);
      expect(livePlans[1]).toMatchObject({ sweep: true, accept: { lockRun: 3 } });
      cardPresent();
      await runFrames(6);

      expect(onLock).toHaveBeenCalledTimes(1);
      expect(liveFrames.length).toBeGreaterThan(1);
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(tracks[0]!.stop).not.toHaveBeenCalled();
      expect(video.srcObject).toBe(stream);
    });
  });

  describe("placement watcher and catch-up on a stand", () => {
    beforeEach(() => {
      onStand = true;
    });

    it("offers a missed placement back as an unidentifiable card the user can dismiss", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await landUnrecognisedCard();
      cardWithCloseRival();
      await pumpCameraFrame();

      expect(onLock).not.toHaveBeenCalled();
      expect(hook.result.current.unidentified).toHaveLength(1);
      const card = hook.result.current.unidentified[0]!;
      expect(card.candidates).toEqual([
        { key: "k-a", artKey: "art-a" },
        { key: "k-b", artKey: "art-b" },
      ]);

      await runFrames(1);
      expect(hook.result.current.readout.placements).toBe(1);
      expect(hook.result.current.readout.missedPlacements).toBe(1);

      act(() => {
        hook.result.current.dismissUnidentified(card.id);
      });
      expect(hook.result.current.unidentified).toEqual([]);
    });

    it("recovers a missed placement outright when the second look verifies it strongly", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await landUnrecognisedCard();
      cardPresent();
      await pumpCameraFrame();

      expect(onLock).toHaveBeenCalledTimes(1);
      const lock = onLock.mock.calls[0]![0];
      expect(lock.key).toBe("k-a");
      expect(lock.framesToLock).toBe(1);
      expect(lock.score).toBe(90);
      expect(hook.result.current.unidentified).toEqual([]);

      await runFrames(1);
      expect(hook.result.current.readout.placements).toBe(1);
      expect(hook.result.current.readout.missedPlacements).toBe(0);
    });

    it("only offers a lone second-look winner at the accept floor", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await landUnrecognisedCard();
      cardAtAcceptFloor();
      await pumpCameraFrame();

      expect(onLock).not.toHaveBeenCalled();
      expect(hook.result.current.unidentified).toHaveLength(1);
      expect(hook.result.current.unidentified[0]!.candidates[0]).toEqual({
        key: "k-a",
        artKey: "art-a",
      });
    });

    it("does not count a card held up under a still camera again as it trembles", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(1);

      for (const seeds of [
        [21, 22, 23],
        [24, 25, 26],
        [27, 28, 29],
      ]) {
        await changeScene(seeds);
        await pumpCameraFrames(3);
      }
      expect(onLock).toHaveBeenCalledTimes(1);
    });

    it("counts a second copy dealt onto the pile", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(1);

      await dealAnotherCopy();
      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(2);
    });

    it("counts no placements while the camera is hand-held", async () => {
      onStand = false;
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await landUnrecognisedCard();
      await runFrames(1);

      // Nothing lands on the ledger, so nothing reaches the second look and
      // the tray never reports a card the hand only appeared to put down.
      expect(hook.result.current.readout.placements).toBe(0);
      expect(hook.result.current.readout.missedPlacements).toBe(0);
      expect(hook.result.current.unidentified).toEqual([]);
    });

    it("drops a placement still on hold when the camera is lifted before it confirms", async () => {
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await pumpCameraFrames(2);
      await changeScene([1, 2, 3]);
      await pumpCameraFrames(DEFAULT_PLACEMENT_OPTIONS.settleFrames);

      onStand = false;
      await pumpCameraFrame();
      await changeScene([4, 5]);
      advance(PLACEMENT_HOLD_SECONDS * 1000);
      onStand = true;
      await pumpCameraFrames(DEFAULT_PLACEMENT_OPTIONS.settleFrames + 2);
      await runFrames(1);

      expect(hook.result.current.readout.placements).toBe(0);
    });
  });

  describe("single-mode re-lock guard", () => {
    it("reports the same card only once while it stays in the guide", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(12);
      expect(onLock).toHaveBeenCalledTimes(1);
    });

    it("ignores a placement signal in single mode, where a hand fakes it", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(1);

      await dealAnotherCopy();
      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(1);
    });
  });

  describe("board reads", () => {
    const BOARD_READ_SETTINGS: ScannerSettings = { ...DEFAULT_SCANNER_SETTINGS, boardReads: true };
    const [guideTopLeft, , guideBottomRight] = centeredGuideQuad(640, 480);
    const cardWidth = (guideBottomRight.x - guideTopLeft.x) / 3;
    const cardHeight = (guideBottomRight.y - guideTopLeft.y) / 3;
    const outlines: CardCandidate[] = [
      guideTopLeft.x + 10,
      guideBottomRight.x - 10 - cardWidth,
    ].map((left) => ({
      quad: [
        { x: left, y: guideTopLeft.y + 10 },
        { x: left + cardWidth, y: guideTopLeft.y + 10 },
        { x: left + cardWidth, y: guideTopLeft.y + 10 + cardHeight },
        { x: left, y: guideTopLeft.y + 10 + cardHeight },
      ],
      areaFraction: 0,
      score: 0.9,
    }));

    function boardCard(key: string, artKey: string): BoardCard {
      return {
        key,
        artKey,
        quad: outlines[0]!.quad,
        score: 0.9,
        rivalScore: 0,
        printingResolved: false,
        distance: 0.05,
        confident: true,
        alternatives: [],
      };
    }

    it("reads the board after two surveys with several cards and skips the card just added", async () => {
      surveyOutlines = outlines;
      readBoardCards = () =>
        Promise.resolve([boardCard("k-a", "art-a"), boardCard("k-b", "art-b")]);
      cardPresent();
      const { hook, onLock, onBoardRead } = await mountReadyScanner({
        boardDetector: true,
        settings: BOARD_READ_SETTINGS,
      });
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(4);
      expect(onLock).toHaveBeenCalledTimes(1);
      cardAbsent();
      await runFrames(3);

      expect(onBoardRead).toHaveBeenCalledTimes(1);
      expect(onBoardRead.mock.calls[0]![0].map((lock) => lock.key)).toEqual(["k-b"]);
    });

    it("does not add a card a board read just added when it is aimed at afterwards", async () => {
      surveyOutlines = outlines;
      readBoardCards = () => Promise.resolve([boardCard("k-b", "art-b")]);
      cardAbsent();
      const { hook, onLock, onBoardRead } = await mountReadyScanner({
        boardDetector: true,
        settings: BOARD_READ_SETTINGS,
      });
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(3);
      expect(onBoardRead).toHaveBeenCalledTimes(1);

      surveyOutlines = null;
      await runFrames(9);
      otherCardPresent();
      await runFrames(6);

      expect(onLock).not.toHaveBeenCalled();
    });

    it("reports nothing from a read whose run was stopped before it finished", async () => {
      const read = deferred<BoardCard[]>();
      surveyOutlines = outlines;
      readBoardCards = vi.fn(() => read.promise);
      cardAbsent();
      const { hook, onBoardRead } = await mountReadyScanner({
        boardDetector: true,
        settings: BOARD_READ_SETTINGS,
      });
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(6);
      expect(readBoardCards).toHaveBeenCalledTimes(1);
      act(() => {
        hook.result.current.stop();
      });
      read.resolve([boardCard("k-b", "art-b")]);
      await act(async () => {
        await flushAsync();
      });

      expect(onBoardRead).not.toHaveBeenCalled();
    });

    it("never reads the board without a board detector", async () => {
      const readBoard = vi.fn(() => Promise.resolve([boardCard("k-b", "art-b")]));
      readBoardCards = readBoard;
      surveyOutlines = outlines;
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(6);

      expect(readBoard).not.toHaveBeenCalled();
    });

    it("never reads the board with board reads switched off", async () => {
      const readBoard = vi.fn(() => Promise.resolve([boardCard("k-b", "art-b")]));
      readBoardCards = readBoard;
      surveyOutlines = outlines;
      cardAbsent();
      const { hook, onBoardRead } = await mountReadyScanner({ boardDetector: true });
      await act(async () => {
        await hook.result.current.start();
      });

      await runFrames(6);

      expect(readBoard).not.toHaveBeenCalled();
      expect(onBoardRead).not.toHaveBeenCalled();
    });
  });

  describe("sweeps", () => {
    it("processes every frame through a disturbance and counts no placement", async () => {
      onStand = true;
      sweeping = true;
      cardAbsent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      await runFrames(1);
      const framesBefore = liveFrames.length;
      const pumpsBefore = pumps;

      await landUnrecognisedCard();
      await runFrames(1);

      expect(liveFrames.length - framesBefore).toBe(pumps - pumpsBefore);
      expect(hook.result.current.readout.placements).toBe(0);
      expect(hook.result.current.unidentified).toEqual([]);
    });
  });

  describe("identifyNow", () => {
    it("adds the card outright when the grabbed frame proves one", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      onLock.mockClear();

      let attempt!: IdentifyAttempt;
      await act(async () => {
        attempt = await hook.result.current.identifyNow();
      });

      expect(attempt.identified).toBe(true);
      expect(onLock).toHaveBeenCalledTimes(1);
      expect(onLock.mock.calls[0]![0].key).toBe("k-a");
    });

    it("only offers a lone winner at the accept floor", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      onLock.mockClear();
      cardAtAcceptFloor();

      let attempt!: IdentifyAttempt;
      await act(async () => {
        attempt = await hook.result.current.identifyNow();
      });

      expect(attempt.identified).toBe(false);
      expect(attempt.candidates[0]).toEqual({ key: "k-a", artKey: "art-a" });
      expect(onLock).not.toHaveBeenCalled();
    });

    it("offers the shortlist when the frame is not convincing on its own", async () => {
      cardAbsent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      onLock.mockClear();
      cardWithCloseRival();

      let attempt!: IdentifyAttempt;
      await act(async () => {
        attempt = await hook.result.current.identifyNow();
      });

      expect(attempt.identified).toBe(false);
      expect(attempt.candidates).toEqual([
        { key: "k-a", artKey: "art-a" },
        { key: "k-b", artKey: "art-b" },
      ]);
      expect(onLock).not.toHaveBeenCalled();
    });

    it("hands the snapshot over before recognition starts", async () => {
      cardPresent();
      const { hook } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      const onSnapshot = vi.fn<(snapshot: string | null) => void>();

      await act(async () => {
        await hook.result.current.identifyNow(onSnapshot);
      });

      expect(onSnapshot).toHaveBeenCalledTimes(1);
    });

    it("does nothing while the camera is stopped", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();

      let attempt!: IdentifyAttempt;
      await act(async () => {
        attempt = await hook.result.current.identifyNow();
      });

      expect(attempt).toEqual({ snapshot: null, identified: false, candidates: [] });
      expect(onLock).not.toHaveBeenCalled();
    });

    it("stops the live pass adding the same card a second time", async () => {
      cardPresent();
      const { hook, onLock } = await mountReadyScanner();
      await act(async () => {
        await hook.result.current.start();
      });
      onLock.mockClear();

      await act(async () => {
        await hook.result.current.identifyNow();
      });
      expect(onLock).toHaveBeenCalledTimes(1);

      await runFrames(8);
      expect(onLock).toHaveBeenCalledTimes(1);
    });
  });
});
