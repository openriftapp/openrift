import type { EncoderGates } from "@openrift/shared/scan/session-options";
import { gatesForEmbedDim } from "@openrift/shared/scan/session-options";
import { describe, expect, it } from "vitest";

import type { ScannerMode } from "@/features/scan/lib/scan-session";
import { lockRunForMode, scanSessionPlans } from "@/features/scan/lib/scan-session";

const GATES: EncoderGates = gatesForEmbedDim(0);

function plansFor(
  mode: ScannerMode,
  overrides: { slowDevice?: boolean; canonical?: boolean } = {},
) {
  return scanSessionPlans({
    mode,
    candidatesToTry: 4,
    slowDevice: overrides.slowDevice ?? false,
    gates: GATES,
    canonical: overrides.canonical ?? true,
  });
}

describe("lockRunForMode", () => {
  it("locks a capture-mode tap on a single verified frame", () => {
    expect(lockRunForMode("capture")).toBe(1);
  });

  it("locks a continuous scan after three frames", () => {
    expect(lockRunForMode("single")).toBe(3);
  });
});

describe("scanSessionPlans", () => {
  it("trims the shortlist", () => {
    expect(plansFor("single").live.topK).toBe(4);
  });

  it("only re-locks after a rearm in single mode", () => {
    expect(plansFor("single").live.accept?.relockOnlyAfterRearm).toBe(true);
    expect(plansFor("capture").live.accept?.relockOnlyAfterRearm).toBeUndefined();
  });

  it("gives every capture tap its own run", () => {
    expect(plansFor("capture").live.accept).toEqual({ lockRun: 1, maxGapFrames: 0 });
  });

  it("cuts the per-frame encoder work on a slow device in guide mode", () => {
    const live = plansFor("single", { slowDevice: true }).live;

    expect(live.candidatesToTry).toBe(1);
    expect(live.topK).toBe(2);
    expect(live.rotationFallbackDistance).toBe(GATES.slowRotationFallbackDistance);
  });

  it("restricts the rotation search to the 180-degree partner with a canonical bank", () => {
    expect(plansFor("single", { canonical: true }).live.rotationPairOnly).toBe(true);
    expect(plansFor("single", { canonical: false }).live.rotationPairOnly).toBe(false);
  });

  it("keeps the catch-up pass never-locking and off the slow bounds", () => {
    for (const mode of ["single", "capture"] as const) {
      const catchUp = plansFor(mode, { slowDevice: true }).catchUp;
      expect(catchUp.accept).toEqual({ lockRun: Number.POSITIVE_INFINITY, maxGapFrames: 0 });
      expect(catchUp.candidatesToTry).toBe(4);
      expect(catchUp.rotationFallbackDistance).toBe(GATES.rotationFallbackDistance);
    }
  });

  it("lets the continuous scan sweep and count on its own, but not a tap or the catch-up pass", () => {
    expect(plansFor("single").live.sweep).toBe(true);
    expect(plansFor("capture").live.sweep).toBe(false);
    expect(plansFor("single").catchUp.sweep).toBeUndefined();
  });
});
