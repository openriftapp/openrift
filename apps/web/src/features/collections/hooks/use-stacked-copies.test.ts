import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { buildStacks } from "@/features/collections/hooks/use-stacked-copies";
import { stubCopy, stubPrinting } from "@/test/factories";

const standard = stubPrinting({
  printingId: "pr-standard",
  cardId: "card-1",
  shortCode: "UNL-001",
});
const foil = stubPrinting({
  printingId: "pr-foil",
  cardId: "card-1",
  shortCode: "UNL-001",
  finish: "foil",
});
const printingById = new Map<string, Printing>([
  [standard.printingId, standard],
  [foil.printingId, foil],
]);
const SETS = [{ id: "set-unleashed", setType: "main" as const }];

function copy(id: string, printingId: string, collectionId: string, groupId: string | null = null) {
  return stubCopy({ id, printingId, collectionId, groupId });
}

describe("buildStacks", () => {
  it("carries every side of a double-sided printing", () => {
    const bird = stubPrinting({ printingId: "pr-pair", side: 1, cardId: "bird" });
    const gold = stubPrinting({ printingId: "pr-pair", side: 2, cardId: "gold" });
    const stacks = buildStacks(
      [copy("c-1", "pr-pair", "col-personal")],
      new Map([["pr-pair", bird]]),
      SETS,
      undefined,
      new Map([["pr-pair", [bird, gold]]]),
    );
    expect(stacks).toEqual([
      { printingId: "pr-pair", printing: bird, sides: [bird, gold], copyIds: ["c-1"] },
    ]);
  });

  it("excludes group-collection copies on the unscoped (All Cards) aggregate", () => {
    const copies = [
      ...Array.from({ length: 9 }, (_unused, index) =>
        copy(`p-${index}`, standard.printingId, "col-personal"),
      ),
      ...Array.from({ length: 21 }, (_unused, index) =>
        copy(`g-${index}`, standard.printingId, "col-group", "group-1"),
      ),
    ];
    const stacks = buildStacks(copies, printingById, SETS, undefined);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.printingId).toBe(standard.printingId);
    expect(stacks[0]!.copyIds).toHaveLength(9);
  });

  it("drops a card owned only in a group collection from the personal aggregate", () => {
    const copies = [copy("g-1", foil.printingId, "col-group", "group-1")];
    expect(buildStacks(copies, printingById, SETS, undefined)).toEqual([]);
  });

  it("includes every copy when scoped to a specific collection, group or not", () => {
    const copies = [
      copy("g-1", standard.printingId, "col-group", "group-1"),
      copy("g-2", standard.printingId, "col-group", "group-1"),
      copy("g-3", standard.printingId, "col-group", "group-1"),
    ];
    const stacks = buildStacks(copies, printingById, SETS, "col-group");
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.copyIds).toHaveLength(3);
  });

  it("skips copies whose printing is unknown", () => {
    const copies = [copy("x-1", "pr-missing", "col-personal")];
    expect(buildStacks(copies, printingById, SETS, undefined)).toEqual([]);
  });
});
