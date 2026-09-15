import { emptyBoardDocument } from "@openrift/shared/board-state";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import type { BoardDraft } from "./board-draft-store";
import { parseBoardDraft, useBoardDraftStore } from "./board-draft-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBoardDraftStore);
});

afterEach(() => {
  resetStore();
});

function draft(overrides: Partial<BoardDraft> = {}): BoardDraft {
  return {
    title: "Stunned defender",
    answer: "",
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    ...overrides,
  };
}

describe("useBoardDraftStore", () => {
  it("starts without a draft", () => {
    expect(useBoardDraftStore.getState().draft).toBeNull();
  });

  it("saves and clears a draft", () => {
    useBoardDraftStore.getState().saveDraft(draft());
    expect(useBoardDraftStore.getState().draft?.title).toBe("Stunned defender");
    useBoardDraftStore.getState().clearDraft();
    expect(useBoardDraftStore.getState().draft).toBeNull();
  });
});

describe("parseBoardDraft", () => {
  it("keeps a valid draft", () => {
    expect(parseBoardDraft(draft())).toEqual(draft());
  });

  it("drops a draft whose document no longer validates", () => {
    expect(parseBoardDraft({ ...draft(), document: { schemaVersion: 99 } })).toBeNull();
  });

  it("drops non-objects and drafts without a title", () => {
    expect(parseBoardDraft(null)).toBeNull();
    expect(parseBoardDraft("draft")).toBeNull();
    expect(parseBoardDraft({ ...draft(), title: 3 })).toBeNull();
  });

  it("fills missing optional fields", () => {
    expect(
      parseBoardDraft({ title: "T", document: emptyBoardDocument(), coreRulesVersion: 5 }),
    ).toEqual({
      title: "T",
      answer: "",
      coreRulesVersion: null,
      tournamentRulesVersion: null,
      document: emptyBoardDocument(),
    });
  });
});
