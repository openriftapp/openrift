import { describe, expect, it } from "vitest";

import type { DownloadProgress, ResourceProgress } from "./scan-load-progress";
import { scanLoadProgress } from "./scan-load-progress";

function resource(overrides: Partial<ResourceProgress> = {}): ResourceProgress {
  return { loaded: 0, total: 0, ready: false, ...overrides };
}

function progress(
  bank: Partial<ResourceProgress>,
  encoder: Partial<ResourceProgress>,
): DownloadProgress {
  return { bank: resource(bank), encoder: resource(encoder) };
}

describe("scanLoadProgress", () => {
  it("starts at zero while nothing has arrived", () => {
    expect(scanLoadProgress(progress({}, {}))).toEqual({ percent: 0, phase: "downloading" });
  });

  it("weights the bank and the encoder equally", () => {
    expect(scanLoadProgress(progress({ ready: true }, { loaded: 50, total: 100 })).percent).toBe(
      75,
    );
  });

  it("counts a ready resource as complete regardless of its byte counts", () => {
    expect(scanLoadProgress(progress({ ready: true }, { ready: true }))).toEqual({
      percent: 100,
      phase: "starting",
    });
  });

  it("switches to starting once every download is in but the engine is not ready", () => {
    const done = { loaded: 100, total: 100 };
    expect(scanLoadProgress(progress(done, done))).toEqual({ percent: 100, phase: "starting" });
  });

  it("stays downloading while the bank is still arriving", () => {
    const done = { loaded: 100, total: 100 };
    expect(scanLoadProgress(progress({ loaded: 10, total: 100 }, done)).phase).toBe("downloading");
  });

  it("clamps over-reported byte counts", () => {
    expect(scanLoadProgress(progress({ ready: true }, { loaded: 150, total: 100 })).percent).toBe(
      100,
    );
  });
});
