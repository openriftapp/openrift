import { describe, expect, it } from "vitest";

import { emptyMetaSyncResult } from "./result.js";
import { isRecheckPassNoop, isSyncNoop } from "./sync-noop.js";

describe("isSyncNoop", () => {
  it("is a noop when a complete run wrote nothing", () => {
    expect(isSyncNoop(emptyMetaSyncResult())).toBe(true);
  });

  it.each([
    ["an insert", { inserted: 1 }],
    ["a change", { changed: 1 }],
    ["a missing row", { missing: 1 }],
    ["an auto-accept", { autoAccepted: 1 }],
    ["a held auto-accept", { autoHeld: 1 }],
    ["an incomplete crawl", { complete: false }],
    ["a cancel", { cancelRequested: true }],
    ["an error", { errors: ["Event 7 detail: HTTP 502"] }],
    ["a block", { blocked: true }],
    ["a throttle", { throttled: true }],
  ])("is not a noop after %s", (_label, overrides) => {
    expect(isSyncNoop({ ...emptyMetaSyncResult(), ...overrides })).toBe(false);
  });

  it("counts the source's own counters", () => {
    expect(isSyncNoop(emptyMetaSyncResult(), [0, 0])).toBe(true);
    expect(isSyncNoop(emptyMetaSyncResult(), [0, 3])).toBe(false);
  });
});

describe("isRecheckPassNoop", () => {
  const idle = { processed: 0, pulledForward: 0, errors: [] };

  it("is a noop when nothing was due", () => {
    expect(isRecheckPassNoop(idle)).toBe(true);
  });

  it.each([
    ["a visit", { processed: 1 }],
    ["a re-armed event", { pulledForward: 2 }],
    ["an error", { errors: ["Event 7: boom"] }],
    ["a block", { blocked: true }],
    ["a cancel", { cancelRequested: true }],
  ])("is not a noop after %s", (_label, overrides) => {
    expect(isRecheckPassNoop({ ...idle, ...overrides })).toBe(false);
  });
});
