import type { MetaPendingSubmission } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import { groupPendingSubmissions } from "./meta-pending-submissions";

function item(overrides: Partial<MetaPendingSubmission> = {}): MetaPendingSubmission {
  return {
    id: "submission-1",
    kind: "new_list",
    metaEventPlayerId: "row-1",
    playerName: "Nova",
    rank: 3,
    rankIsTier: false,
    mine: false,
    ...overrides,
  };
}

const PLAYERS = [{ id: "row-1" }, { id: "row-2" }];

describe("groupPendingSubmissions", () => {
  it("marks the standings row a submission was sent from", () => {
    const grouped = groupPendingSubmissions([item()], PLAYERS);

    expect(grouped.byPlayer.get("row-1")).toEqual({ mine: false });
    expect(grouped.unmatched).toEqual([]);
  });

  it("marks a row as the viewer's when any of its submissions is theirs", () => {
    const grouped = groupPendingSubmissions([item({ mine: true }), item()], PLAYERS);

    expect(grouped.byPlayer.get("row-1")).toEqual({ mine: true });
  });

  it("lists a submission sent without a row as unmatched", () => {
    const loose = item({ metaEventPlayerId: null });
    const grouped = groupPendingSubmissions([loose], PLAYERS);

    expect(grouped.byPlayer.size).toBe(0);
    expect(grouped.unmatched).toEqual([loose]);
  });

  it("lists a submission whose row left the standings as unmatched", () => {
    const orphan = item({ metaEventPlayerId: "row-gone" });

    expect(groupPendingSubmissions([orphan], PLAYERS).unmatched).toEqual([orphan]);
  });

  it("lists an event correction, which names no player, as unmatched", () => {
    const correction = item({
      kind: "event_correction",
      metaEventPlayerId: null,
      playerName: null,
      rank: null,
      rankIsTier: null,
    });

    expect(groupPendingSubmissions([correction], PLAYERS).unmatched).toEqual([correction]);
  });
});
