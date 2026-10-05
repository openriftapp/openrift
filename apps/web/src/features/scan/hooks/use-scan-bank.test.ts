import type { CardLabels } from "@openrift/shared/scan/labels";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScanServing } from "@/features/scan/hooks/use-scan-serving";
import { useScanServing } from "@/features/scan/hooks/use-scan-serving";
import { loadScanLabels } from "@/features/scan/lib/scan-bank";

import { useScanBank } from "./use-scan-bank";

vi.mock("@/features/scan/hooks/use-scan-serving", () => ({
  useScanServing: vi.fn(),
}));

vi.mock("@/features/scan/lib/scan-bank", () => ({
  loadScanLabels: vi.fn(),
}));

const FIRST: CardLabels = { "k-a": { name: "Lux", code: "OGN-001", language: "en" } };
const SECOND: CardLabels = { "k-b": { name: "Garen", code: "OGN-002", language: "en" } };

function ready(labelsUrl: string): ScanServing {
  return {
    status: "ready",
    assets: {
      encoderUrl: "https://assets.invalid/encoder.onnx",
      bankUrl: `${labelsUrl}.bin`,
      labelsUrl,
      detectorUrl: "https://assets.invalid/detector.onnx",
      boardDetectorUrl: null,
      bankHash: null,
      entryCount: null,
      builtAt: null,
    },
  };
}

function deferredLabels() {
  let finish!: (labels: CardLabels) => void;
  // oxlint-disable-next-line promise/avoid-new -- held open until the test finishes it
  const promise = new Promise<CardLabels>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

describe("useScanBank", () => {
  let serving: ScanServing;

  beforeEach(() => {
    serving = ready("https://assets.invalid/labels-1.json");
    vi.mocked(useScanServing).mockImplementation(() => serving);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the old labels while a rebuilt bank's labels load", async () => {
    const second = deferredLabels();
    vi.mocked(loadScanLabels).mockImplementation((url) =>
      url.endsWith("labels-1.json") ? Promise.resolve(FIRST) : second.promise,
    );
    const { result, rerender } = renderHook(() => useScanBank());
    await waitFor(() => {
      expect(result.current.labels).toBe(FIRST);
    });

    serving = ready("https://assets.invalid/labels-2.json");
    rerender();

    expect(result.current.labels).toBeNull();
    second.finish(SECOND);
    await waitFor(() => {
      expect(result.current.labels).toBe(SECOND);
    });
  });

  it("reports the scanner as unavailable without naming a cause", () => {
    serving = { status: "unavailable", assets: null };

    const { result } = renderHook(() => useScanBank());

    expect(result.current.unavailableMessage).toBe(
      "The scanner is not available right now. Please try again later.",
    );
  });
});
