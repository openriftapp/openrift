import type {
  DeckCheckEntryState,
  DeckCheckReviewOutcome,
} from "@openrift/shared/types/api/deck-check";
import { describe, expect, it } from "vitest";

import { canRequestChanges, isPendingTransition } from "./deck-check-actions";

function entry(
  state: DeckCheckEntryState,
  reviewOutcome: DeckCheckReviewOutcome | null,
  claimedUserId: string | null,
) {
  return { state, reviewOutcome, claimedUserId };
}

describe("canRequestChanges", () => {
  it("allows requesting changes on a claimed, unflagged submission", () => {
    expect(canRequestChanges(entry("submitted", null, "user-1"))).toBe(true);
    expect(canRequestChanges(entry("submitted", "ok", "user-1"))).toBe(true);
  });

  it("hides the action once the submission is already flagged as an issue", () => {
    expect(canRequestChanges(entry("submitted", "issue", "user-1"))).toBe(false);
  });

  it("hides the action when the entry is not claimed", () => {
    expect(canRequestChanges(entry("submitted", null, null))).toBe(false);
    expect(canRequestChanges(entry("submitted", "ok", null))).toBe(false);
  });

  it("only applies to submitted entries", () => {
    for (const state of ["editable", "approved", "checked", "withdrawn"] as const) {
      expect(canRequestChanges(entry(state, null, "user-1"))).toBe(false);
    }
  });
});

describe("isPendingTransition", () => {
  it("matches only the transition that is running", () => {
    const running = { state: "checked", reviewOutcome: "issue" } as const;
    expect(isPendingTransition(running, "checked", "issue")).toBe(true);
    expect(isPendingTransition(running, "checked", "ok")).toBe(false);
    expect(isPendingTransition(running, "submitted")).toBe(false);
  });

  it("treats a missing review outcome as no outcome", () => {
    expect(isPendingTransition({ state: "editable" }, "editable")).toBe(true);
    expect(isPendingTransition({ state: "editable" }, "editable", "issue")).toBe(false);
  });

  it("is false while nothing runs", () => {
    expect(isPendingTransition(null, "submitted")).toBe(false);
  });
});
