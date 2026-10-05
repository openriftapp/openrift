import type { CardLabels } from "@openrift/shared/scan/labels";
import { DEFAULT_SESSION_OPTIONS, gatesForEmbedDim } from "@openrift/shared/scan/session-options";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLOW_DEVICE_EMBED_MS } from "@/features/scan/lib/scan-embedder";
import { DEFAULT_SCANNER_SETTINGS } from "@/features/scan/lib/scan-session";
import type { ScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import { createScanWorkerClient } from "@/features/scan/lib/scan-worker-client";
import type { ScanAssets, ScanWorkerReady } from "@/features/scan/lib/scan-worker-protocol";

import { useScanEngine } from "./use-scan-engine";

vi.mock("@/features/scan/lib/scan-worker-client", () => ({
  createScanWorkerClient: vi.fn(),
}));

const ASSETS: ScanAssets = {
  encoderUrl: "https://assets.invalid/encoder.onnx",
  bankUrl: "https://assets.invalid/bank.bin",
  labelsUrl: "https://assets.invalid/labels.json",
  detectorUrl: "https://assets.invalid/detector.onnx",
  boardDetectorUrl: null,
};

const LABELS: CardLabels = { "k-a": { name: "Lux", code: "OGN-001", language: "en" } };

const REBUILT: ScanAssets = {
  ...ASSETS,
  bankUrl: "https://assets.invalid/bank-v2.bin",
  labelsUrl: "https://assets.invalid/labels-v2.json",
};

const REBUILT_LABELS: CardLabels = { "k-b": { name: "Garen", code: "OGN-002", language: "en" } };

const GATES = gatesForEmbedDim(256);

const READY: ScanWorkerReady = {
  embedMsPerImage: 80,
  embedImageSize: 224,
  threads: 4,
  keys: ["k-a"],
  artKeys: [["k-a", "art-a"]],
  canonical: true,
  bytes: 1024,
  gates: GATES,
};

function fakeClient(init: ScanWorkerClient["init"]): ScanWorkerClient {
  return {
    init,
    create: vi.fn(() => Promise.resolve()),
    processFrame: vi.fn(),
    readBoard: vi.fn(),
    rearm: vi.fn(),
    terminate: vi.fn(),
  };
}

describe("useScanEngine", () => {
  let client: ScanWorkerClient;

  beforeEach(() => {
    vi.stubGlobal("Worker", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(createScanWorkerClient).mockImplementation((onProgress) => {
      client = fakeClient(async () => {
        onProgress?.("encoder", 10, 20);
        onProgress?.("bank", 5, 5);
        return READY;
      });
      return client;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts the worker and reports its progress, cost and status", async () => {
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });

    expect(result.current.embedMsPerImage).toBe(80);
    expect(result.current.threads).toBe(4);
    expect(result.current.progress).toEqual({
      encoder: { loaded: 10, total: 20, ready: true },
      bank: { loaded: 5, total: 5, ready: true },
    });
    expect(result.current.error).toBeNull();
  });

  it("waits for the asset manifest before starting the worker", () => {
    renderHook(() => useScanEngine(null, LABELS));

    expect(createScanWorkerClient).not.toHaveBeenCalled();
  });

  it("reports a browser without workers", async () => {
    vi.stubGlobal("Worker", undefined);
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await waitFor(() => {
      expect(result.current.error).toBe(
        "This browser cannot run the scanner. Update it or try another browser.",
      );
    });
    expect(createScanWorkerClient).not.toHaveBeenCalled();
  });

  it("reports a browser that refuses to create the worker", async () => {
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      throw new Error("workers blocked");
    });
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await waitFor(() => {
      expect(result.current.error).toBe(
        "This browser cannot run the scanner. Update it or try another browser.",
      );
    });
    expect(result.current.hasSession()).toBe(false);
    expect(result.current.engineReady).toBe(false);
  });

  it("drops a worker whose init failed and reports why", async () => {
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      client = fakeClient(() => Promise.reject(new Error("Could not load the card detector")));
      return client;
    });
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await waitFor(() => {
      expect(result.current.error).toBe("Could not load the card detector");
    });
    expect(client.terminate).toHaveBeenCalled();
    expect(result.current.hasSession()).toBe(false);
    expect(result.current.engineReady).toBe(false);
  });

  it("falls back to the generic start failure for a non-Error rejection", async () => {
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      // oxlint-disable-next-line prefer-promise-reject-errors -- the case under test is a non-Error rejection
      client = fakeClient(() => Promise.reject("wire unplugged"));
      return client;
    });
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await waitFor(() => {
      expect(result.current.error).toBe("The scanning engine failed to start");
    });
  });

  it("restarts a worker whose init was still pending when an asset url changed", async () => {
    const clients: ScanWorkerClient[] = [];
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      const index = clients.length;
      const created = fakeClient(() =>
        // oxlint-disable-next-line promise/avoid-new -- the first init never settles
        index === 0 ? new Promise(() => {}) : Promise.resolve(READY),
      );
      clients.push(created);
      return created;
    });
    const { result, rerender } = renderHook((assets: ScanAssets) => useScanEngine(assets, LABELS), {
      initialProps: ASSETS,
    });

    rerender({ ...ASSETS, detectorUrl: "https://assets.invalid/detector-v2.onnx" });

    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });
    expect(clients).toHaveLength(2);
    expect(clients[0]!.terminate).toHaveBeenCalled();
    expect(clients[1]!.terminate).not.toHaveBeenCalled();
  });

  it("clears a failed start once a restarted worker loads", async () => {
    let attempt = 0;
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      attempt++;
      client = fakeClient(() =>
        attempt === 1
          ? Promise.reject(new Error("Could not load the card detector"))
          : Promise.resolve(READY),
      );
      return client;
    });
    const { result, rerender } = renderHook((assets: ScanAssets) => useScanEngine(assets, LABELS), {
      initialProps: ASSETS,
    });
    await waitFor(() => {
      expect(result.current.error).toBe("Could not load the card detector");
    });

    rerender({ ...ASSETS, detectorUrl: "https://assets.invalid/detector-v2.onnx" });

    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });

  it("reloads a loaded worker when the bank is rebuilt, never pairing old and new", async () => {
    const { result, rerender } = renderHook(
      ({ assets, labels }: { assets: ScanAssets; labels: CardLabels | null }) =>
        useScanEngine(assets, labels),
      { initialProps: { assets: ASSETS, labels: LABELS } },
    );
    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });
    const first = client;
    const firstKey = result.current.bankKey;

    rerender({ assets: REBUILT, labels: REBUILT_LABELS });

    expect(first.terminate).toHaveBeenCalled();
    expect(result.current.bank).toBeNull();
    expect(result.current.hasSession()).toBe(false);
    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });
    expect(createScanWorkerClient).toHaveBeenCalledTimes(2);
    expect(result.current.bank?.labels).toBe(REBUILT_LABELS);
    expect(result.current.bankKey).not.toBe(firstKey);
  });

  it("terminates the worker on unmount", async () => {
    const { result, unmount } = renderHook(() => useScanEngine(ASSETS, LABELS));
    await waitFor(() => {
      expect(result.current.engineReady).toBe(true);
    });

    unmount();

    expect(client.terminate).toHaveBeenCalled();
  });
});

describe("useScanEngine sessions", () => {
  let client: ScanWorkerClient;
  let ready: ScanWorkerReady;

  beforeEach(() => {
    ready = READY;
    vi.stubGlobal("Worker", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      client = fakeClient(() => Promise.resolve(ready));
      return client;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mountReady(labels: CardLabels | null = LABELS) {
    const hook = renderHook(() => useScanEngine(ASSETS, labels));
    await waitFor(() => {
      expect(hook.result.current.engineReady).toBe(true);
    });
    return hook;
  }

  it("creates both sessions once the engine and labels are ready", async () => {
    const { result } = await mountReady();

    await expect(result.current.prepare(DEFAULT_SCANNER_SETTINGS, null)).resolves.toBe(true);

    expect(client.create).toHaveBeenCalledOnce();
  });

  it("refuses to prepare without labels", async () => {
    const { result } = await mountReady(null);

    await expect(result.current.prepare(DEFAULT_SCANNER_SETTINGS, null)).resolves.toBe(false);

    expect(result.current.bank).toBeNull();
    expect(client.create).not.toHaveBeenCalled();
  });

  it("refuses to prepare before the engine is ready", async () => {
    vi.mocked(createScanWorkerClient).mockImplementation(() => {
      // oxlint-disable-next-line promise/avoid-new -- an init that never settles
      client = fakeClient(() => new Promise(() => {}));
      return client;
    });
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));

    await expect(result.current.prepare(DEFAULT_SCANNER_SETTINGS, null)).resolves.toBe(false);

    expect(client.create).not.toHaveBeenCalled();
  });

  it("waits for the frame in flight before replacing the sessions", async () => {
    const { result } = await mountReady();
    let finish!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- a frame held in flight until the test releases it
    const inFlight = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const prepared = result.current.prepare(DEFAULT_SCANNER_SETTINGS, inFlight);
    await Promise.resolve();
    expect(client.create).not.toHaveBeenCalled();
    finish();

    await expect(prepared).resolves.toBe(true);
    expect(client.create).toHaveBeenCalledOnce();
  });

  it("replaces the sessions after a frame in flight that failed", async () => {
    const { result } = await mountReady();

    await expect(
      result.current.prepare(DEFAULT_SCANNER_SETTINGS, Promise.reject(new Error("frame failed"))),
    ).resolves.toBe(true);

    expect(client.create).toHaveBeenCalledOnce();
  });

  it("rejects when the worker cannot build the sessions", async () => {
    const { result } = await mountReady();
    vi.mocked(client.create).mockRejectedValue(new Error("bad plan"));

    await expect(result.current.prepare(DEFAULT_SCANNER_SETTINGS, null)).rejects.toThrow(
      "bad plan",
    );
  });

  it("plans a lighter live session on a slow device", async () => {
    ready = { ...READY, embedMsPerImage: SLOW_DEVICE_EMBED_MS + 1 };
    const { result } = await mountReady();

    await result.current.prepare(DEFAULT_SCANNER_SETTINGS, null);

    expect(result.current.slowDevice).toBe(true);
    const [live] = vi.mocked(client.create).mock.calls[0]!;
    expect(live.candidatesToTry).toBe(1);
  });

  it("derives the idle gate from the bank's encoder gates", async () => {
    const { result } = await mountReady();

    expect(result.current.idleGate).toBe(GATES.rotationFallbackDistance);
  });

  it("uses the default idle gate while loading", () => {
    const { result } = renderHook(() => useScanEngine(null, LABELS));

    expect(result.current.idleGate).toBe(DEFAULT_SESSION_OPTIONS.rotationFallbackDistance);
  });

  it("joins the labels with what the worker decoded", async () => {
    const { result } = await mountReady();

    expect(result.current.bank).toMatchObject({ keys: ["k-a"], labels: LABELS, bytes: 1024 });
    expect(result.current.bank?.artKeys.get("k-a")).toBe("art-a");
  });

  it("returns the worker's outcome for a frame", async () => {
    const { result } = await mountReady();
    await result.current.prepare(DEFAULT_SCANNER_SETTINGS, null);
    const outcome = { sweeping: false };
    vi.mocked(client.processFrame).mockResolvedValue(outcome as never);

    await expect(
      result.current.processFrame(
        "live",
        { data: new Uint8ClampedArray(4), width: 1, height: 1 },
        0,
        0,
      ),
    ).resolves.toBe(outcome);
  });

  it("reports no outcome and no board without a worker", async () => {
    vi.stubGlobal("Worker", undefined);
    const { result } = renderHook(() => useScanEngine(ASSETS, LABELS));
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

    expect(result.current.hasSession()).toBe(false);
    await expect(result.current.processFrame("live", frame, 0, 0)).resolves.toBeNull();
    await expect(result.current.readBoard(frame)).resolves.toBeNull();
  });

  it("sends no frame to a worker whose sessions are not built", async () => {
    const { result } = await mountReady();
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

    expect(result.current.hasSession()).toBe(false);
    await expect(result.current.processFrame("live", frame, 0, 0)).resolves.toBeNull();
    expect(client.processFrame).not.toHaveBeenCalled();
  });

  it("drops a frame the replaced worker was still processing instead of failing it", async () => {
    const hook = renderHook((assets: ScanAssets) => useScanEngine(assets, LABELS), {
      initialProps: ASSETS,
    });
    await waitFor(() => {
      expect(hook.result.current.engineReady).toBe(true);
    });
    await hook.result.current.prepare(DEFAULT_SCANNER_SETTINGS, null);
    const first = client;
    let fail!: (error: Error) => void;
    vi.mocked(first.processFrame).mockReturnValue(
      // oxlint-disable-next-line promise/avoid-new -- held open until the worker is replaced
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    const pending = hook.result.current.processFrame("live", frame, 0, 0);

    hook.rerender(REBUILT);
    fail(new Error("the scan worker was stopped"));

    await expect(pending).resolves.toBeNull();
  });

  it("still fails a frame the current worker could not process", async () => {
    const { result } = await mountReady();
    await result.current.prepare(DEFAULT_SCANNER_SETTINGS, null);
    vi.mocked(client.processFrame).mockRejectedValue(new Error("embed failed"));
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

    await expect(result.current.processFrame("live", frame, 0, 0)).rejects.toThrow("embed failed");
  });
});
