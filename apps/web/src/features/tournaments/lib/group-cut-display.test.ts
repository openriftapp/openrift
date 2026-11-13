import type { GroupQualificationRowView } from "@openrift/shared/types/api/pod-tournament";
import { describe, expect, it } from "vitest";

import {
  checkGroupPlayerCount,
  cutLineExplanation,
  cutStageIndex,
  formatMetaShare,
} from "./group-cut-display";

describe("cutStageIndex", () => {
  it("maps the first cut round of a top 8 to the quarterfinal of a four-stage list", () => {
    expect(cutStageIndex(8, 4, 4)).toBe(1);
    expect(cutStageIndex(8, 6, 4)).toBe(3);
  });

  it("maps a top 4 onto a list that only names its own stages", () => {
    expect(cutStageIndex(4, 4, 2)).toBe(0);
    expect(cutStageIndex(4, 5, 2)).toBe(1);
  });

  it("returns null for group-stage rounds and rounds past the final", () => {
    expect(cutStageIndex(8, 3, 4)).toBeNull();
    expect(cutStageIndex(4, 6, 4)).toBeNull();
  });
});

describe("checkGroupPlayerCount", () => {
  it("rejects fewer than six players and odd fields", () => {
    expect(checkGroupPlayerCount(4).valid).toBe(false);
    expect(checkGroupPlayerCount(7).valid).toBe(false);
    expect(checkGroupPlayerCount(8)).toEqual({ valid: true, message: null });
  });
});

function row(
  displayName: string,
  overrides: Partial<GroupQualificationRowView> = {},
): GroupQualificationRowView {
  return {
    playerId: displayName.toLowerCase(),
    displayName,
    groupLabel: "A",
    place: 2,
    matchWinRate: 0.667,
    gameWinRate: 0.5,
    legendCount: 2,
    metaShare: 0.2,
    decidedBy: null,
    seed: null,
    qualified: false,
    ...overrides,
  };
}

describe("cutLineExplanation", () => {
  it("returns null while nobody has qualified or everyone has", () => {
    expect(cutLineExplanation([row("Ashe")], 8)).toBeNull();
    expect(cutLineExplanation([row("Ashe", { qualified: true, seed: 1 })], 8)).toBeNull();
  });

  it("names the group place when the two sit in different tiers", () => {
    const result = cutLineExplanation(
      [
        row("Ashe", { place: 1, qualified: true, seed: 8 }),
        row("Braum", { place: 2, groupLabel: "B", matchWinRate: 1 }),
      ],
      8,
    );
    expect(result?.heading).toBe("Why is Ashe in the top 8 and Braum not?");
    expect(result?.body).toBe(
      "Ashe finished in place 1 of Group A, Braum in place 2 of Group B. A better group place ranks first, whatever the win rates.",
    );
  });

  it("walks through the tied criteria down to the meta share", () => {
    const result = cutLineExplanation(
      [
        row("Ashe", { qualified: true, seed: 8, metaShare: 0.12 }),
        row("Braum", { decidedBy: "meta_share", metaShare: 0.25 }),
      ],
      8,
    );
    expect(result?.body).toBe(
      "Both are Runners-up. They are level on match win rate (67%) and game win rate (50%), and their Legends are equally common in the field. Ashe takes the spot on the lower meta share (12.0% against 25.0%).",
    );
  });

  it("names the rarer Legend with both counts", () => {
    const result = cutLineExplanation(
      [
        row("Ashe", { qualified: true, seed: 8, legendCount: 1 }),
        row("Braum", { decidedBy: "legend_count", legendCount: 3 }),
      ],
      8,
    );
    expect(result?.body).toContain(
      "Ashe plays the rarer Legend in the field (1 against 3 players).",
    );
  });

  it("says the spot waits when a meta share is missing", () => {
    const result = cutLineExplanation(
      [row("Ashe", { qualified: true, seed: 8 }), row("Braum", { decidedBy: "meta_pending" })],
      8,
    );
    expect(result?.body).toContain("The spot waits on the meta shares of their Legends.");
  });

  it("returns null when the first player out carries no criterion", () => {
    expect(
      cutLineExplanation([row("Ashe", { qualified: true, seed: 8 }), row("Braum")], 8),
    ).toBeNull();
  });
});

describe("formatMetaShare", () => {
  it("shows one decimal and a dash for a missing share", () => {
    expect(formatMetaShare(0.1234)).toBe("12.3%");
    expect(formatMetaShare(null)).toBe("-");
  });
});
