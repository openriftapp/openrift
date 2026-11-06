import { describe, expect, it } from "vitest";

import { alreadyInCollectionCounts, copyIdsToMove } from "./copy-move-plan";

const byCopy = new Map([
  ["c1", "binder"],
  ["c2", "binder"],
  ["c3", "inbox"],
]);

describe("alreadyInCollectionCounts", () => {
  it("counts the copies per collection they sit in", () => {
    expect(alreadyInCollectionCounts(["c1", "c2", "c3"], byCopy)).toEqual(
      new Map([
        ["binder", 2],
        ["inbox", 1],
      ]),
    );
  });

  it("counts a duplicated id once", () => {
    expect(alreadyInCollectionCounts(["c1", "c1"], byCopy)).toEqual(new Map([["binder", 1]]));
  });

  it("skips copies the lookup does not know", () => {
    expect(alreadyInCollectionCounts(["c9"], byCopy)).toEqual(new Map());
    expect(alreadyInCollectionCounts([], byCopy)).toEqual(new Map());
  });
});

describe("copyIdsToMove", () => {
  it("leaves out copies already in the target", () => {
    expect(copyIdsToMove(["c1", "c2", "c3"], byCopy, "binder")).toEqual(["c3"]);
  });

  it("moves every copy when none is in the target", () => {
    expect(copyIdsToMove(["c1", "c3"], byCopy, "trade-binder")).toEqual(["c1", "c3"]);
  });

  it("returns nothing when all copies are already in the target", () => {
    expect(copyIdsToMove(["c1", "c2"], byCopy, "binder")).toEqual([]);
  });

  it("dedupes ids and keeps unknown copies movable", () => {
    expect(copyIdsToMove(["c3", "c3", "c9"], byCopy, "binder")).toEqual(["c3", "c9"]);
  });
});
