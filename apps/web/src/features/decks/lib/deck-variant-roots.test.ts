import { describe, expect, it } from "vitest";

import { orderVariantRoots } from "./deck-variant-roots";

interface Member {
  id: string;
  updatedAt: string;
  parent: string | null;
}

function order(members: Member[], currentId: string): string[] {
  const parents = new Map(members.map((member) => [member.id, member.parent]));
  const roots = members.filter((member) => member.parent === null);
  const childrenOf = (id: string) => members.filter((member) => member.parent === id);
  return orderVariantRoots(roots, childrenOf, parents, currentId).map((member) => member.id);
}

describe("orderVariantRoots", () => {
  it("puts the tree with the newest member last", () => {
    expect(
      order(
        [
          { id: "a", updatedAt: "2026-01-01", parent: null },
          { id: "a1", updatedAt: "2026-03-01", parent: "a" },
          { id: "b", updatedAt: "2026-02-01", parent: null },
        ],
        "b",
      ),
    ).toEqual(["b", "a"]);
  });

  it("puts the open deck's tree last on a tie", () => {
    expect(
      order(
        [
          { id: "a", updatedAt: "2026-01-01", parent: null },
          { id: "b", updatedAt: "2026-01-01", parent: null },
          { id: "b1", updatedAt: "2026-01-01", parent: "b" },
        ],
        "a",
      ),
    ).toEqual(["b", "a"]);
  });

  it("finds the open deck's tree through its ancestors", () => {
    expect(
      order(
        [
          { id: "a", updatedAt: "2026-01-01", parent: null },
          { id: "b", updatedAt: "2026-01-01", parent: null },
          { id: "b1", updatedAt: "2026-01-01", parent: "b" },
        ],
        "b1",
      ),
    ).toEqual(["a", "b"]);
  });

  it("falls back to id order and leaves the input untouched", () => {
    const members = [
      { id: "c", updatedAt: "2026-01-01", parent: null },
      { id: "a", updatedAt: "2026-01-01", parent: null },
    ];
    expect(order(members, "x")).toEqual(["a", "c"]);
    expect(members.map((member) => member.id)).toEqual(["c", "a"]);
  });
});
