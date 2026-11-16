import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { toPackPrinting, toPackResult } from "./pack-opener-utils";

describe("toPackResult", () => {
  it("keeps each pull's slot and outcome and flattens its printing", () => {
    const printing = stubPrinting({ printingId: "p-1", card: { name: "Jinx" } });
    const result = toPackResult({
      pulls: [
        {
          slot: "rare",
          outcome: "alt-art",
          printing: { printingId: "p-1", printing } as never,
        },
      ],
    });
    expect(result.pulls).toEqual([
      { slot: "rare", outcome: "alt-art", printing: toPackPrinting(printing) },
    ]);
    expect(result.pulls[0]?.printing.cardName).toBe("Jinx");
  });
});
