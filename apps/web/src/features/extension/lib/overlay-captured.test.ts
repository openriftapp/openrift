import { describe, expect, it } from "vitest";

import { isSnapshotCaptured } from "./overlay-captured";

const GENERATED_AT = "2026-09-09T12:30:00.000Z";

describe("isSnapshotCaptured", () => {
  it("matches when the extension stored this exact snapshot", () => {
    expect(isSnapshotCaptured(GENERATED_AT, GENERATED_AT)).toBe(true);
  });

  it("does not match an older snapshot the extension still holds", () => {
    expect(isSnapshotCaptured("2026-09-09T11:00:00.000Z", GENERATED_AT)).toBe(false);
  });

  it("does not match when the attribute is absent", () => {
    expect(isSnapshotCaptured(null, GENERATED_AT)).toBe(false);
    expect(isSnapshotCaptured(undefined, GENERATED_AT)).toBe(false);
  });

  it("does not match an empty attribute against an empty timestamp", () => {
    expect(isSnapshotCaptured("", "")).toBe(false);
  });
});
