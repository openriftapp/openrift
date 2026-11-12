import { describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

import { describeAcceptOutcome, showAcceptOutcome } from "./accept-outcome";

const SKIP = { label: "OGN-002", reason: "missing: artist" };

describe("describeAcceptOutcome", () => {
  it("reports a clean accept as a success", () => {
    expect(describeAcceptOutcome(2, [])).toEqual({
      kind: "success",
      message: "Accepted 2 printings",
    });
  });

  it("names every skip with its reason next to what was accepted", () => {
    expect(describeAcceptOutcome(1, [SKIP])).toEqual({
      kind: "warning",
      message: "Accepted 1 printing, skipped 1: OGN-002 (missing: artist)",
    });
  });

  it("reports an accept that skipped everything as an error", () => {
    expect(describeAcceptOutcome(0, [SKIP])).toEqual({
      kind: "error",
      message: "All skipped: OGN-002 (missing: artist)",
    });
  });

  it("says when there was nothing to accept", () => {
    expect(describeAcceptOutcome(0, [])).toEqual({
      kind: "info",
      message: "No printings to accept",
    });
  });

  it("leads with the subject and uses the given noun", () => {
    expect(describeAcceptOutcome(3, [], { noun: "change", subject: "Created jinx" })).toEqual({
      kind: "success",
      message: "Created jinx. Accepted 3 changes",
    });
    expect(describeAcceptOutcome(0, [SKIP], { subject: "Created jinx" }).kind).toBe("warning");
  });
});

describe("showAcceptOutcome", () => {
  it("toasts the described outcome", () => {
    showAcceptOutcome(1, [SKIP]);
    expect(toast.warning).toHaveBeenCalledWith(
      "Accepted 1 printing, skipped 1: OGN-002 (missing: artist)",
    );
  });
});
