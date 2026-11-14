import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import type { IdentifyAttempt } from "@/features/scan/lib/scan-catchup";
import type { ScanPrintingIndex } from "@/features/scan/lib/scan-resolve";
import { stubPrinting } from "@/test/factories";

import { useScanIdentify } from "./use-scan-identify";

const sett = stubPrinting({ card: { name: "Kingpin", types: ["legend"], tags: ["Sett"] } });

const BANK: ScanBankInfo = {
  keys: ["k-sett", "k-poro"],
  artKeys: new Map([
    ["k-sett", "art-sett"],
    ["k-poro", "art-poro"],
  ]),
  labels: {
    "k-sett": { name: "Kingpin", code: "OGN-301", language: "EN", type: "legend" },
    "k-poro": { name: "Poro (Snow Day)", code: "OGN-999", language: "EN" },
  },
  bytes: 1024,
};

const INDEX: ScanPrintingIndex = {
  byImageId: new Map([["k-sett", [sett]]]),
  keysByArtKey: new Map(),
};

function mount(identifyNow: () => Promise<IdentifyAttempt>) {
  return renderHook(() =>
    useScanIdentify({
      bank: BANK,
      index: INDEX,
      identifyNow,
      unidentified: [],
      dismissUnidentified: vi.fn(),
      onPick: vi.fn(),
      onPickPrinting: vi.fn(),
    }),
  );
}

describe("useScanIdentify", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the recognising state when the attempt throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = mount(() => Promise.reject(new Error("worker gone")));

    await act(async () => {
      result.current.run();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.candidates).toEqual([]);
  });

  it("keeps the empty state, not the failure line, for a frame with no card", async () => {
    const { result } = mount(() =>
      Promise.resolve({ snapshot: null, identified: false, candidates: [] }),
    );

    await act(async () => {
      result.current.run();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.failed).toBe(false);
    expect(result.current.candidates).toEqual([]);
  });

  it("names candidates by their catalogue display name, with the code apart", async () => {
    const { result } = mount(() =>
      Promise.resolve({
        snapshot: null,
        identified: false,
        candidates: [
          { key: "k-sett", artKey: "art-sett" },
          { key: "k-poro", artKey: "art-poro" },
        ],
      }),
    );

    await act(async () => {
      result.current.run();
    });

    expect(result.current.failed).toBe(false);
    expect(result.current.candidates.map(({ name, detail }) => ({ name, detail }))).toEqual([
      { name: "Sett, Kingpin", detail: "OGN-301 EN" },
      { name: "Poro (Snow Day)", detail: "OGN-999 EN" },
    ]);
  });
});
