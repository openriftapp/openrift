import { describe, expect, it } from "vitest";

import type { GameOutcome } from "./swiss-results";
import {
  clearGame,
  endAtOpenGame,
  countsFromGames,
  emptyGameRows,
  gamesFromCounts,
  setGame,
  swissPointsPreview,
  visibleGameCount,
  withoutUnplayed,
} from "./swiss-results";

describe("game rows", () => {
  it("shows game 2 once game 1 is played and game 3 only while the match is open", () => {
    let rows = emptyGameRows("bo3");
    expect(visibleGameCount(rows, "bo3")).toBe(1);
    rows = setGame(rows, 0, "first", "bo3");
    expect(visibleGameCount(rows, "bo3")).toBe(2);
    rows = setGame(rows, 1, "first", "bo3");
    expect(visibleGameCount(rows, "bo3")).toBe(2);
    rows = setGame(rows, 1, "second", "bo3");
    expect(visibleGameCount(rows, "bo3")).toBe(3);
  });

  it("clears game 3 when changing game 2 decides the match", () => {
    let rows = emptyGameRows("bo3");
    rows = setGame(rows, 0, "first", "bo3");
    rows = setGame(rows, 1, "second", "bo3");
    rows = setGame(rows, 2, "draw", "bo3");
    rows = setGame(rows, 1, "first", "bo3");
    expect(rows).toEqual(["first", "first", null]);
  });

  it("hides the later games behind a game that was not played", () => {
    let rows = emptyGameRows("bo3");
    rows = setGame(rows, 0, "first", "bo3");
    rows = setGame(rows, 1, "draw", "bo3");
    rows = setGame(rows, 2, "second", "bo3");
    rows = setGame(rows, 1, "unplayed", "bo3");
    expect(rows).toEqual(["first", "unplayed", null]);
  });

  it("counts wins and drawn games once every shown game is filled in", () => {
    let rows = emptyGameRows("bo3");
    rows = setGame(rows, 0, "draw", "bo3");
    expect(countsFromGames(rows, "bo3", true)).toBeNull();
    rows = setGame(rows, 1, "first", "bo3");
    rows = setGame(rows, 2, "unplayed", "bo3");
    expect(countsFromGames(rows, "bo3", true)).toEqual({ gamePoints: [1, 0], drawnGames: 1 });
  });

  it("needs a played first game", () => {
    const rows = setGame(emptyGameRows("bo3"), 0, "unplayed", "bo3");
    expect(countsFromGames(rows, "bo3", true)).toBeNull();
  });

  it("needs a winner when draws are off", () => {
    let rows = emptyGameRows("bo3");
    rows = setGame(rows, 0, "first", "bo3");
    rows = setGame(rows, 1, "second", "bo3");
    rows = setGame(rows, 2, "unplayed", "bo3");
    expect(countsFromGames(rows, "bo3", false)).toBeNull();
    expect(countsFromGames(rows, "bo3", true)).toEqual({ gamePoints: [1, 1], drawnGames: 0 });
  });
});

describe("gamesFromCounts", () => {
  it("puts drawn games first and the deciding win last", () => {
    expect(gamesFromCounts({ gamePoints: [2, 0], drawnGames: 1 }, "bo3", true)).toEqual([
      "draw",
      "first",
      "first",
    ]);
    expect(gamesFromCounts({ gamePoints: [1, 2], drawnGames: 0 }, "bo3", true)).toEqual([
      "first",
      "second",
      "second",
    ]);
  });

  it("marks the next game as not played after a time-limit result", () => {
    expect(gamesFromCounts({ gamePoints: [1, 0], drawnGames: 0 }, "bo3", true)).toEqual([
      "first",
      "unplayed",
      null,
    ]);
    expect(gamesFromCounts({ gamePoints: [1, 1], drawnGames: 0 }, "bo3", true)).toEqual([
      "first",
      "second",
      "unplayed",
    ]);
  });

  it("round-trips every result the rows can produce", () => {
    const outcomes: GameOutcome[] = ["first", "second", "draw", "unplayed"];
    for (const one of outcomes) {
      for (const two of outcomes) {
        for (const three of outcomes) {
          let rows = emptyGameRows("bo3");
          rows = setGame(rows, 0, one, "bo3");
          rows = setGame(rows, 1, two, "bo3");
          rows = setGame(rows, 2, three, "bo3");
          const counts = countsFromGames(rows, "bo3", true);
          if (counts === null) {
            continue;
          }
          const rebuilt = gamesFromCounts(counts, "bo3", true);
          expect(rebuilt === null ? null : countsFromGames(rebuilt, "bo3", true)).toEqual(counts);
        }
      }
    }
  });

  it("leaves a result the rows cannot express unselected", () => {
    expect(gamesFromCounts({ gamePoints: [77, 0], drawnGames: 0 }, "bo3", true)).toBeNull();
    expect(gamesFromCounts({ gamePoints: [3, 1], drawnGames: 0 }, "bo3", true)).toBeNull();
    expect(gamesFromCounts({ gamePoints: [0, 0], drawnGames: 0 }, "bo3", true)).toBeNull();
    expect(gamesFromCounts({ gamePoints: [2, 0], drawnGames: 1 }, "bo3", false)).toBeNull();
    expect(gamesFromCounts({ gamePoints: [2, 1], drawnGames: 0 }, "bo1", true)).toBeNull();
  });

  it("rebuilds a Bo1 game", () => {
    expect(gamesFromCounts({ gamePoints: [0, 1], drawnGames: 0 }, "bo1", true)).toEqual(["second"]);
    expect(gamesFromCounts({ gamePoints: [0, 0], drawnGames: 1 }, "bo1", true)).toEqual(["draw"]);
  });
});

describe("swissPointsPreview", () => {
  it("maps a win to the win points and the loss to zero", () => {
    expect(swissPointsPreview([2, 1], 3, 1)).toEqual([3, 0]);
    expect(swissPointsPreview([0, 1], 3, 1)).toEqual([0, 3]);
  });

  it("maps any tied scoreline to the draw points", () => {
    expect(swissPointsPreview([1, 1], 3, 1)).toEqual([1, 1]);
    expect(swissPointsPreview([0, 0], 3, 1)).toEqual([1, 1]);
  });

  it("honors custom point values", () => {
    expect(swissPointsPreview([2, 0], 5, 2)).toEqual([5, 0]);
    expect(swissPointsPreview([1, 1], 5, 2)).toEqual([2, 2]);
  });
});

describe("endAtOpenGame", () => {
  it("marks the first open game after game 1 as not played", () => {
    expect(endAtOpenGame(["first", null, null], "bo3")).toEqual(["first", "unplayed", null]);
    expect(endAtOpenGame(["first", "second", null], "bo3")).toEqual([
      "first",
      "second",
      "unplayed",
    ]);
  });

  it("has nothing to cut before game 1 or once every shown game is in", () => {
    expect(endAtOpenGame([null, null, null], "bo3")).toBeNull();
    expect(endAtOpenGame(["first", "first", null], "bo3")).toBeNull();
    expect(endAtOpenGame(["first"], "bo1")).toBeNull();
  });
});

describe("withoutUnplayed", () => {
  it("reopens games marked not played", () => {
    expect(withoutUnplayed(["first", "unplayed", null])).toEqual(["first", null, null]);
  });
});

describe("clearGame", () => {
  it("reopens the game and every game after it", () => {
    expect(clearGame(["first", "second", "first"], 1)).toEqual(["first", null, null]);
    expect(clearGame(["draw", null, null], 0)).toEqual([null, null, null]);
  });
});
