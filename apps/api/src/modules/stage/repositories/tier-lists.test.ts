import { describe, expect, it } from "vitest";

import { normalizeTiers } from "./tier-lists.js";

const CARD = (n: number): string => `c0000000-0000-4000-a000-00000000000${n}`;
const PRINTING = (n: number): string => `d0000000-0000-4000-a000-00000000000${n}`;

describe("normalizeTiers", () => {
  it("keeps a current row's pinned printings", () => {
    expect(
      normalizeTiers([{ label: "A", cards: [{ cardId: CARD(3), printingId: PRINTING(3) }] }]),
    ).toEqual([{ label: "A", cards: [{ cardId: CARD(3), printingId: PRINTING(3) }] }]);
  });

  it("fills a missing printing with null rather than leaving the key off", () => {
    const [row] = normalizeTiers([
      { label: "S", cards: [{ cardId: CARD(1) } as { cardId: string; printingId: null }] },
    ]);
    expect(row?.cards[0]).toEqual({ cardId: CARD(1), printingId: null });
  });

  it("keeps the unranked flag only when it is set", () => {
    expect(
      normalizeTiers([
        { label: "S", cards: [], unranked: true },
        { label: "A", cards: [], unranked: false },
      ]),
    ).toEqual([
      { label: "S", cards: [], unranked: true },
      { label: "A", cards: [] },
    ]);
  });
});
