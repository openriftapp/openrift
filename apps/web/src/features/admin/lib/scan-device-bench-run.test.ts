import type { ClipTruth } from "@openrift/shared/scan/bench-score";
import type { CardLabel } from "@openrift/shared/scan/labels";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BenchJob } from "@/features/admin/lib/scan-device-bench-run";
import {
  identityLookup,
  postDeviceRun,
  runBench,
  runSpeedCheck,
  truthGroups,
} from "@/features/admin/lib/scan-device-bench-run";
import type { ScanWorkerReady } from "@/features/scan/lib/scan-worker-protocol";

function label(code: string, language: string, markers?: string | null): CardLabel {
  return { name: code, code, language, markers };
}

const loaded = {
  labels: {
    "ogn-001-en": label("OGN-001", "EN"),
    "ogn-001-zh": label("OGN-001", "ZH"),
    "ogn-001-promo": label("OGN-001", "EN", "promo"),
    "ogn-002-en": label("OGN-002", "EN"),
    "ogn-003-en": label("OGN-003", "EN"),
    "unlabelled-art": label("OGN-099", "EN"),
  },
  artKeys: new Map([
    ["ogn-001-en", "art-1"],
    ["ogn-001-zh", "art-1"],
    ["ogn-001-promo", "art-1"],
    ["ogn-002-en", "art-2"],
    ["ogn-003-en", "art-3"],
    ["no-label", "art-9"],
  ]),
};
const identityOf = identityLookup(loaded);

function truth(cards: ClipTruth["cards"]): ClipTruth {
  return { split: "tune", mode: "single", reviewed: true, cards };
}

describe("identityLookup", () => {
  it("joins a key's label with its artwork", () => {
    expect(identityOf("ogn-001-promo")).toEqual({
      name: "OGN-001",
      artKey: "art-1",
      publicCode: "OGN-001",
      language: "EN",
      markers: "promo",
    });
  });

  it("reads a missing marker as none recorded", () => {
    expect(identityOf("ogn-002-en")?.markers).toBeNull();
  });

  it("knows nothing about a key without a label or an artwork", () => {
    expect(identityOf("no-label")).toBeUndefined();
    expect(identityOf("unlabelled-art")).toBeUndefined();
  });
});

describe("truthGroups", () => {
  const bankKeys = ["ogn-001-en", "ogn-001-zh", "ogn-002-en", "ogn-003-en"];

  it("keeps a truth artwork the bank carries as its own group", () => {
    const groups = truthGroups(
      truth([{ artKey: "art-1", name: "Ahri" }]),
      bankKeys,
      new Set(["art-1"]),
      identityOf,
    );
    expect(groups).toEqual(new Map([["art-1", "art-1"]]));
  });

  it("falls back to the artwork behind the labelled printing's public code", () => {
    const groups = truthGroups(
      truth([
        {
          artKey: "art-merged",
          name: "Ahri",
          printing: { publicCode: "OGN-002", language: "EN" },
        },
      ]),
      bankKeys,
      new Set(),
      identityOf,
    );
    expect(groups).toEqual(new Map([["art-merged", "art-2"]]));
  });

  it("prefers the printing's language and accepts any language when none match", () => {
    const groups = truthGroups(
      truth([
        { artKey: "a", name: "A", printing: { publicCode: "OGN-001", language: "ZH" } },
        { artKey: "b", name: "B", printing: { publicCode: "OGN-003", language: "FR" } },
      ]),
      bankKeys,
      new Set(),
      identityOf,
    );
    expect(groups).toEqual(
      new Map([
        ["a", "art-1"],
        ["b", "art-3"],
      ]),
    );
  });

  it("leaves a card out when its public code is ambiguous or unknown", () => {
    const ambiguous = {
      ...loaded,
      artKeys: new Map([...loaded.artKeys, ["ogn-001-zh", "art-other"]]),
    };
    const groups = truthGroups(
      truth([
        { artKey: "a", name: "A", printing: { publicCode: "OGN-001", language: "FR" } },
        { artKey: "b", name: "B", printing: { publicCode: "OGN-404", language: "EN" } },
        { artKey: "c", name: "C" },
      ]),
      bankKeys,
      new Set(),
      identityLookup(ambiguous),
    );
    expect(groups.size).toBe(0);
  });
});

describe("postDeviceRun", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the payload and returns the saved path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("device-runs/speed.json"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postDeviceRun("speed", { fps: 30 })).resolves.toBe("device-runs/speed.json");

    expect(fetchMock).toHaveBeenCalledWith(
      "/__device-runs?kind=speed",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ fps: 30 }) }),
    );
  });

  it("sends nothing outside the dev server", async () => {
    vi.stubEnv("DEV", false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(postDeviceRun("bench", {})).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the dev server refuses the run", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));

    await expect(postDeviceRun("bench", {})).resolves.toBeNull();
  });

  it("returns null when the request cannot be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(postDeviceRun("bench", {})).resolves.toBeNull();
  });
});

describe("a missing bench pack", () => {
  const init = vi.fn();
  const processFrame = vi.fn();
  const job = {
    assets: {
      encoderUrl: "encoder.onnx",
      bankUrl: "bank.bin",
      labelsUrl: "labels.json",
      detectorUrl: "detector.onnx",
      boardDetectorUrl: null,
      bankHash: null,
    },
    labels: {},
    client: { init, create: vi.fn(() => Promise.resolve()), processFrame, rearm: vi.fn() },
    onProgress: vi.fn(),
  } as unknown as BenchJob;

  function stubPack(index: Response | null, frame: Response | null): void {
    vi.stubGlobal("document", { createElement: () => ({}) });
    vi.stubGlobal("navigator", { userAgent: "test" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("index.json") ? index : frame)),
    );
    init.mockResolvedValue({
      embedMsPerImage: 10,
      embedImageSize: 192,
      threads: 1,
      keys: ["ogn-001-en"],
      artKeys: [["ogn-001-en", "art-1"]],
      canonical: true,
      bytes: 0,
      gates: {
        confidentDistance: 0.2,
        rotationFallbackDistance: 0.3,
        slowRotationFallbackDistance: 0.4,
        topK: 8,
      },
    } satisfies ScanWorkerReady);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    init.mockReset();
    processFrame.mockReset();
  });

  it("stops the bench before loading the engine when the pack has no index", async () => {
    stubPack(new Response("", { status: 404 }), null);

    await expect(runBench(job)).rejects.toThrow(/No bench pack/u);
    expect(init).not.toHaveBeenCalled();
  });

  it("stops the speed check before loading the engine when the pack has no index", async () => {
    stubPack(new Response("", { status: 404 }), null);

    await expect(runSpeedCheck(job)).rejects.toThrow(/No bench pack/u);
    expect(init).not.toHaveBeenCalled();
  });

  it("names the clip and frame when a frame file is missing", async () => {
    const clips = [{ clip: "clip-a", frames: 80, truth: truth([]) }];
    stubPack(Response.json({ clips }), new Response("", { status: 404 }));

    await expect(runSpeedCheck(job)).rejects.toThrow(/^frame \d+ of clip-a is missing$/u);
    expect(processFrame).not.toHaveBeenCalled();
  });

  it("passes a thread count from the bench page url to the engine", async () => {
    const clips = [{ clip: "clip-a", frames: 80, truth: truth([]) }];
    stubPack(Response.json({ clips }), new Response("", { status: 404 }));
    vi.stubGlobal("location", { search: "?ortThreads=2" });

    await expect(runSpeedCheck(job)).rejects.toThrow(/is missing/u);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ encoderUrl: "encoder.onnx" }), 2);
  });
});
