import { describe, expect, it } from "vitest";

import { ScanWorkerFailureError, engineLoadFailure } from "@/features/scan/lib/scan-engine-failure";

describe("engineLoadFailure", () => {
  it("names the asset whose request failed, with the network text", () => {
    expect(engineLoadFailure(new ScanWorkerFailureError("Failed to fetch", "labels"))).toBe(
      "Card labels: Can't reach the server. Check your connection.",
    );
  });

  it("keeps the detail of a failed download", () => {
    expect(
      engineLoadFailure(
        new ScanWorkerFailureError("Could not load the scan bank from /b.bin", "bank"),
      ),
    ).toBe("Card bank: Could not load the scan bank from /b.bin");
  });

  it("falls back to the start failure without an asset or a message", () => {
    expect(engineLoadFailure("wire unplugged")).toBe("The scanning engine failed to start");
  });
});
