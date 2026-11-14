import { describe, expect, it } from "vitest";

import type { MatchedEntry } from "@/features/collections/lib/import-matcher";
import { stubPrinting } from "@/test/factories";

import { buildListImportPayload } from "./list-import-payload";

function matched(overrides: Partial<MatchedEntry>): MatchedEntry {
  return {
    entry: {
      setPrefix: "",
      finish: "normal",
      artVariant: "normal",
      quantity: 1,
      cardName: "Teemo, Scout",
      sourceCode: "",
      rawFields: {},
    },
    status: "needs-review",
    resolvedPrinting: null,
    candidates: [],
    ...overrides,
  };
}

describe("buildListImportPayload", () => {
  it("sends cardId for card-kind lists", () => {
    const printing = stubPrinting({ printingId: "printing-1", cardId: "card-1" });
    const entries = [
      matched({ status: "exact", resolvedPrinting: printing, candidates: [printing] }),
    ];
    expect(buildListImportPayload(entries, "card")).toEqual([{ cardId: "card-1", quantity: 1 }]);
  });

  it("sends printingId for printing-kind lists", () => {
    const printing = stubPrinting({ printingId: "printing-1", cardId: "card-1" });
    const entries = [
      matched({ status: "exact", resolvedPrinting: printing, candidates: [printing] }),
    ];
    expect(buildListImportPayload(entries, "printing")).toEqual([
      { printingId: "printing-1", quantity: 1 },
    ]);
  });

  it("carries each row's quantity through", () => {
    const printing = stubPrinting({ printingId: "printing-9", cardId: "card-9" });
    const entries = [
      matched({
        status: "exact",
        resolvedPrinting: printing,
        candidates: [printing],
        entry: {
          setPrefix: "",
          finish: "normal",
          artVariant: "normal",
          quantity: 4,
          cardName: "Fury Rune",
          sourceCode: "",
          rawFields: {},
        },
      }),
    ];
    expect(buildListImportPayload(entries, "printing")).toEqual([
      { printingId: "printing-9", quantity: 4 },
    ]);
  });
});
