import type {
  ArchiveListEligibility,
  ArchiveListParticipant,
} from "@openrift/shared/types/api/tournament";
import { describe, expect, it } from "vitest";

import {
  canForceArchiveList,
  isArchiveListSendable,
  planArchiveListSend,
  resolveArchiveListPick,
} from "./archive-lists";

function participant(
  participantId: string,
  eligibility: ArchiveListEligibility,
  suggestedIdentity: string | null = null,
): ArchiveListParticipant {
  return {
    participantId,
    displayName: participantId,
    entryState: null,
    eligibility,
    unmatchedLines: 0,
    suggestedIdentity,
  };
}

describe("resolveArchiveListPick", () => {
  it("falls back to the suggestion until the organizer picks", () => {
    expect(resolveArchiveListPick(undefined, "u11")).toBe("u11");
  });

  it("keeps an explicit pick, including an explicit none", () => {
    expect(resolveArchiveListPick("u12", "u11")).toBe("u12");
    expect(resolveArchiveListPick(null, "u11")).toBeNull();
  });
});

describe("canForceArchiveList", () => {
  it("only offers an override for an unfinished deck check", () => {
    expect(canForceArchiveList("unchecked")).toBe(true);
    for (const eligibility of [
      "ready",
      "no_consent",
      "no_name_consent",
      "withdrawn",
      "no_list",
    ] as const) {
      expect(canForceArchiveList(eligibility)).toBe(false);
    }
  });
});

describe("isArchiveListSendable", () => {
  it("sends a ready list and a forced unchecked one", () => {
    expect(isArchiveListSendable("ready", false)).toBe(true);
    expect(isArchiveListSendable("unchecked", false)).toBe(false);
    expect(isArchiveListSendable("unchecked", true)).toBe(true);
    expect(isArchiveListSendable("no_consent", true)).toBe(false);
  });
});

describe("planArchiveListSend", () => {
  it("links ready lists to their picked or suggested standing", () => {
    const plan = planArchiveListSend(
      [participant("p1", "ready", "u11"), participant("p2", "ready")],
      { p2: "u12" },
      {},
    );
    expect(plan.links).toEqual([
      { participantId: "p1", identity: "u11", force: false },
      { participantId: "p2", identity: "u12", force: false },
    ]);
    expect(plan).toMatchObject({ unmatched: 0, leftOut: 0 });
  });

  it("counts lists that cannot go and sendable lists with no standing", () => {
    const plan = planArchiveListSend(
      [
        participant("p1", "ready"),
        participant("p2", "unchecked", "u12"),
        participant("p3", "no_consent", "u13"),
        participant("p4", "ready", "u14"),
      ],
      { p4: null },
      {},
    );
    expect(plan.links).toEqual([]);
    expect(plan).toMatchObject({ unmatched: 2, leftOut: 2 });
  });

  it("sends a forced unchecked list with the override flag", () => {
    const plan = planArchiveListSend([participant("p1", "unchecked", "u11")], {}, { p1: true });
    expect(plan.links).toEqual([{ participantId: "p1", identity: "u11", force: true }]);
  });

  it("flags a standing picked twice", () => {
    const plan = planArchiveListSend(
      [participant("p1", "ready", "u11"), participant("p2", "ready")],
      { p2: "u11" },
      {},
    );
    expect([...plan.duplicates]).toEqual(["u11"]);
  });
});
