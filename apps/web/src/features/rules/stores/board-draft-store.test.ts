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

  it("upgrades a stored v1 document", () => {
    const v1 = {
      schemaVersion: 1,
      playerCount: 2,
      battlefields: [{ card: null }],
      zones: {
        base: true,
        legend: false,
        champion: false,
        runes: false,
        hand: false,
        trash: false,
        chain: false,
      },
      steps: [
        {
          caption: "",
          pieces: [
            {
              id: "p1",
              owner: "A",
              zone: { kind: "base" },
              kind: "unit",
              card: null,
              exhausted: false,
              stunned: true,
              damage: 0,
              buff: 2,
              highlight: false,
            },
          ],
          chain: [],
          arrows: [],
        },
      ],
    };
    const parsed = parseBoardDraft({ ...draft(), document: v1 });
    expect(parsed?.document.schemaVersion).toBe(2);
    expect(parsed?.document.steps[0]?.pieces[0]).toMatchObject({
      keywords: ["Stun"],
      might: 2,
    });
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
