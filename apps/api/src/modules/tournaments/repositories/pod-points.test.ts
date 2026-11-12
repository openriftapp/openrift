import { describe, expect, it } from "vitest";

import {
  isResultlessPod,
  podSizeOf,
  pointsForPod,
  pointsForTeamPod,
  teamsOf,
} from "./pod-points.js";
import type { PodScoring } from "./pod-tournaments-shared.js";

const SCORING: PodScoring = {
  scheme: "standard",
  byePoints: 3,
  winPoints: 3,
  drawPoints: 1,
  playMode: "1v1",
};

describe("isResultlessPod", () => {
  const noGames = (count: number) => Array.from({ length: count }, () => ({ gamePoints: null }));

  it("marks a 3 or 4 player pod without game points as having no result", () => {
    expect(isResultlessPod(noGames(3), null)).toBe(true);
    expect(isResultlessPod(noGames(4), null)).toBe(true);
  });

  it("keeps a two-sided walkover and any pod with game points", () => {
    expect(isResultlessPod(noGames(2), null)).toBe(false);
    expect(isResultlessPod(noGames(4), ["t1", "t2"])).toBe(false);
    expect(isResultlessPod([{ gamePoints: 0 }, { gamePoints: 0 }, { gamePoints: 0 }], null)).toBe(
      false,
    );
  });
});

describe("podSizeOf", () => {
  it("narrows the stored sizes to the literal union", () => {
    expect([podSizeOf(2), podSizeOf(3), podSizeOf(4)]).toEqual([2, 3, 4]);
  });

  it("treats an out-of-domain size as a 4-pod", () => {
    expect(podSizeOf(7)).toBe(4);
  });
});

describe("pointsForPod", () => {
  it("scores a 2-pod as a Swiss match on the tournament's win/draw points", () => {
    expect(pointsForPod([1, 2], 2, SCORING)).toEqual([3, 0]);
    expect(pointsForPod([1, 1], 2, SCORING)).toEqual([1, 1]);
  });

  it("scores larger pods from the placement table", () => {
    expect(pointsForPod([1, 2, 3, 4], 4, SCORING)).toEqual([3, 2, 1, 0]);
    expect(pointsForPod([1, 2, 3], 3, SCORING)).toEqual([3, 2, 1]);
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

describe("pointsForTeamPod", () => {
  it("gives both members of the winning team the full win points", () => {
    const members = [
      { teamId: "x", placement: 1 },
      { teamId: "y", placement: 3 },
      { teamId: "x", placement: 2 },
      { teamId: "y", placement: 4 },
    ];
    expect(pointsForTeamPod(members, ["x", "y"], SCORING)).toEqual([3, 0, 3, 0]);
  });

  it("splits draw points when both teams share the best placement", () => {
    const members = [
      { teamId: "x", placement: 1 },
      { teamId: "y", placement: 1 },
      { teamId: "x", placement: 3 },
      { teamId: "y", placement: 3 },
    ];
    expect(pointsForTeamPod(members, ["x", "y"], SCORING)).toEqual([1, 1, 1, 1]);
  });
});
