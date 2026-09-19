import type { MetaRunRound } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import { metaCutRoundLabel, metaRunRecord } from "./meta-player-run";

function round(overrides: Partial<MetaRunRound> = {}): MetaRunRound {
  return {
    phaseOrder: 1,
    roundNumber: 1,
    isCut: false,
    tableNumber: 1,
    outcome: "win",
    gamesWon: 2,
    gamesLost: 0,
    opponentId: "p-2",
    ...overrides,
  };
}

describe("metaRunRecord", () => {
  it("sums a run the way the standings do, a bye counting as the win it is", () => {
    expect(
      metaRunRecord([
        round({ outcome: "win" }),
        round({ outcome: "bye" }),
        round({ outcome: "loss" }),
        round({ outcome: "draw" }),
        round({ outcome: "unknown" }),
      ]),
    ).toEqual({ wins: 2, losses: 1, draws: 1 });
  });

  it("sums an empty run to nothing", () => {
    expect(metaRunRecord([])).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});

describe("metaCutRoundLabel", () => {
  it("names the last three cut rounds the way players do", () => {
    expect(metaCutRoundLabel(3, 3)).toBe("Final");
    expect(metaCutRoundLabel(2, 3)).toBe("Semifinal");
    expect(metaCutRoundLabel(1, 3)).toBe("Quarterfinal");
  });

  it("names a deeper cut by the bracket it opens", () => {
    expect(metaCutRoundLabel(1, 4)).toBe("Top 16");
  });
});
