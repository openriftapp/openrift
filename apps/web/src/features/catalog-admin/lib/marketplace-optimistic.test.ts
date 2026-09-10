import type { UnifiedMappingsCardResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { applyOptimisticAssignments } from "@/features/catalog-admin/lib/marketplace-optimistic";
import {
  makeStagedProduct,
  makeUnifiedMappingGroup,
  makeUnifiedMappingPrinting,
} from "@/test/factories";

const printing = makeUnifiedMappingPrinting({ printingId: "p-en" });

function response(): UnifiedMappingsCardResponse {
  return {
    group: makeUnifiedMappingGroup({
      printings: [printing],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 5 })],
        assignedProducts: [],
        assignments: [],
      },
    }),
    allCards: [],
  };
}

const assignment = {
  marketplace: "tcgplayer" as const,
  externalId: 5,
  finish: "normal",
  language: "EN",
  printingId: "p-en",
};

describe("applyOptimisticAssignments", () => {
  it("moves the product from staged to assigned and records the link", () => {
    const next = applyOptimisticAssignments(response(), [assignment]);
    expect(next.group?.tcgplayer.stagedProducts).toEqual([]);
    expect(next.group?.tcgplayer.assignedProducts).toHaveLength(1);
    expect(next.group?.tcgplayer.assignments).toEqual([
      { externalId: 5, printingId: "p-en", finish: "normal", language: "EN" },
    ]);
  });

  it("leaves the original response untouched", () => {
    const before = response();
    applyOptimisticAssignments(before, [assignment]);
    expect(before.group?.tcgplayer.stagedProducts).toHaveLength(1);
    expect(before.group?.tcgplayer.assignments).toEqual([]);
  });

  it("ignores an assignment to a printing the card does not have", () => {
    const before = response();
    const next = applyOptimisticAssignments(before, [{ ...assignment, printingId: "p-missing" }]);
    expect(next).toBe(before);
  });

  it("folds several assignments in one pass", () => {
    const foil = makeUnifiedMappingPrinting({ printingId: "p-foil", finish: "foil" });
    const start: UnifiedMappingsCardResponse = {
      group: makeUnifiedMappingGroup({
        printings: [printing, foil],
        tcgplayer: {
          stagedProducts: [
            makeStagedProduct({ externalId: 5 }),
            makeStagedProduct({ externalId: 6, finish: "foil" }),
          ],
          assignedProducts: [],
          assignments: [],
        },
      }),
      allCards: [],
    };
    const next = applyOptimisticAssignments(start, [
      assignment,
      { ...assignment, externalId: 6, finish: "foil", printingId: "p-foil" },
    ]);
    expect(next.group?.tcgplayer.stagedProducts).toEqual([]);
    expect(next.group?.tcgplayer.assignments).toHaveLength(2);
  });

  it("returns a card with no marketplace group unchanged", () => {
    const empty: UnifiedMappingsCardResponse = { group: null, allCards: [] };
    expect(applyOptimisticAssignments(empty, [assignment])).toBe(empty);
  });
});
