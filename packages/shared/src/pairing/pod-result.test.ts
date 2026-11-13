import { describe, expect, it } from "vitest";

import { isResultlessPod, teamsOf } from "./pod-result";

describe("isResultlessPod", () => {
  const noGames = (count: number) => Array.from({ length: count }, () => ({ gamePoints: null }));

  it("marks a 3 or 4 player pod without game points as having no result", () => {
    expect(isResultlessPod(noGames(3), null)).toBe(true);
    expect(isResultlessPod(noGames(4), null)).toBe(true);
  });

  it("marks a pending 3 player pod without placements as having no result", () => {
    const pending = Array.from({ length: 3 }, () => ({ gamePoints: null, placement: null }));
    expect(isResultlessPod(pending, null)).toBe(true);
  });

  it("keeps a two-sided walkover and any pod with game points", () => {
    expect(isResultlessPod(noGames(2), null)).toBe(false);
    expect(isResultlessPod(noGames(4), ["t1", "t2"])).toBe(false);
    expect(isResultlessPod([{ gamePoints: 0 }, { gamePoints: 0 }, { gamePoints: 0 }], null)).toBe(
      false,
    );
  });
});

describe("teamsOf", () => {
  it("returns the two team ids of a full 2v2 pod", () => {
    expect(teamsOf([{ teamId: "x" }, { teamId: "y" }, { teamId: "x" }, { teamId: "y" }])).toEqual([
      "x",
      "y",
    ]);
  });

  it("returns null when the members are not two full teams", () => {
    expect(teamsOf([{ teamId: "x" }, { teamId: "y" }])).toBeNull();
    expect(
      teamsOf([{ teamId: "x" }, { teamId: null }, { teamId: "x" }, { teamId: "y" }]),
    ).toBeNull();
    expect(
      teamsOf([{ teamId: "x" }, { teamId: "y" }, { teamId: "z" }, { teamId: "y" }]),
    ).toBeNull();
  });
});
