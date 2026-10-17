import { describe, expect, it } from "vitest";

import type { ScanIndexRow } from "../repositories/scan-index.js";
import { isScanAvailable } from "./scan-available.js";

const INDEX = { bankHash: "511b47521ffca52a" } as ScanIndexRow;

describe("isScanAvailable", () => {
  it("is available with a built bank and a configured detector", () => {
    expect(isScanAvailable(INDEX, { detectorFile: "scan-detector-v2.onnx" })).toBe(true);
  });

  it("is unavailable before any bank is built", () => {
    expect(isScanAvailable(null, { detectorFile: "scan-detector-v2.onnx" })).toBe(false);
  });

  it("is unavailable without a configured detector", () => {
    expect(isScanAvailable(INDEX, { detectorFile: null })).toBe(false);
  });
});
