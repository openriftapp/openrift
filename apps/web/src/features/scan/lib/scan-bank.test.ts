import { encodeEmbedBank } from "@openrift/shared/scan/embed-format";
import type { CardLabels } from "@openrift/shared/scan/labels";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  describeKey,
  isLandscapeKey,
  loadScanBank,
  loadScanLabels,
  scanBankInfo,
} from "@/features/scan/lib/scan-bank";
import type { ScanWorkerReady } from "@/features/scan/lib/scan-worker-protocol";

const labels: CardLabels = {
  battlefield: { name: "Star Spring", code: "OGN-286/298", language: "en", type: "battlefield" },
  unit: { name: "Lux", code: "OGN-011/298", language: "en", type: "unit" },
  untyped: { name: "Unknown Render", code: "OGN-999/298", language: "en" },
};

describe("describeKey", () => {
  it("names a labelled key", () => {
    expect(describeKey(labels, "unit")).toBe("Lux (OGN-011/298 en)");
  });

  it("falls back to a short key when the label is missing", () => {
    expect(describeKey(labels, "0123456789abcdef")).toBe("unknown 01234567");
  });
});

describe("isLandscapeKey", () => {
  it("reports Battlefield art as landscape", () => {
    expect(isLandscapeKey(labels, "battlefield")).toBe(true);
  });

  it("reports every other card type as portrait", () => {
    expect(isLandscapeKey(labels, "unit")).toBe(false);
  });

  it("reports portrait for a label predating the type field", () => {
    expect(isLandscapeKey(labels, "untyped")).toBe(false);
  });

  it("reports portrait for an unlabelled key", () => {
    expect(isLandscapeKey(labels, "missing")).toBe(false);
  });
});

describe("loadScanBank", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes the bank's artwork keys beside its labels", async () => {
    const dim = 256;
    const shared = Array.from({ length: dim }, (_, index) => (index === 0 ? 1 : 0));
    const artKeyOf: Record<string, string> = {
      "ogn-rune": "OGN|Order Rune|normal|",
      "sfd-rune": "SFD|Order Rune|normal|",
    };
    const buffer = encodeEmbedBank(
      { keys: ["ogn-rune", "sfd-rune"], vectors: new Float32Array([...shared, ...shared]) },
      (key) => artKeyOf[key] ?? key,
      true,
    );
    const runeLabels: CardLabels = {
      "ogn-rune": { name: "Order Rune", code: "OGN-214/298", language: "EN", type: "rune" },
      "sfd-rune": { name: "Order Rune", code: "SFD-R06", language: "EN", type: "rune" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith(".bin") ? new Response(buffer) : Response.json(runeLabels),
      ),
    );

    const loaded = await loadScanBank("/media/scan/bank.bin", "/media/scan/labels.json");

    expect(Object.fromEntries(loaded.artKeys)).toEqual(artKeyOf);
    expect(loaded.labels).toEqual(runeLabels);
    expect(loaded.bytes).toBe(buffer.byteLength);
  });

  it("names the missing bank when its download fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith(".bin") ? new Response(null, { status: 404 }) : Response.json({}),
      ),
    );

    await expect(loadScanBank("/media/scan/bank.bin", "/media/scan/labels.json")).rejects.toThrow(
      "/media/scan/bank.bin",
    );
  });
});

describe("loadScanLabels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the published labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(labels)),
    );

    await expect(loadScanLabels("/media/scan/labels.json")).resolves.toEqual(labels);
  });

  it("falls back to no labels when the file is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(loadScanLabels("/media/scan/labels.json")).resolves.toEqual({});
  });
});

describe("scanBankInfo", () => {
  const ready: ScanWorkerReady = {
    embedMsPerImage: 80,
    embedImageSize: 224,
    threads: 4,
    keys: ["ogn-rune", "sfd-rune", "ogn-lux"],
    artKeys: [
      ["ogn-rune", "Order Rune"],
      ["sfd-rune", "Order Rune"],
      ["ogn-lux", "Lux"],
    ],
    canonical: true,
    bytes: 2048,
    gates: {
      confidentDistance: 0.2,
      rotationFallbackDistance: 0.3,
      slowRotationFallbackDistance: 0.4,
      topK: 8,
    },
  };

  it("indexes the worker's artwork keys next to the labels", () => {
    const info = scanBankInfo(labels, ready);

    expect(info.artKeys.get("sfd-rune")).toBe("Order Rune");
    expect(info).toMatchObject({ keys: ready.keys, labels, bytes: 2048 });
  });
});
