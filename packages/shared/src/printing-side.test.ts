import { describe, expect, it } from "vitest";

import {
  countPrintings,
  indexByPrinting,
  ownedTotalsByCard,
  sideKey,
  uniquePrintings,
} from "./printing-side";

const birdSide = { printingId: "p-1", side: 1 as const, cardId: "bird" };
const goldSide = { printingId: "p-1", side: 2 as const, cardId: "gold" };
const buffFront = { printingId: "p-2", side: 1 as const, cardId: "buff" };
const buffBack = { printingId: "p-2", side: 2 as const, cardId: "buff" };
const single = { printingId: "p-3", side: 1 as const, cardId: "bird" };

describe("sideKey", () => {
  it("is the printing id for side 1 and suffixed for side 2", () => {
    expect(sideKey(birdSide)).toBe("p-1");
    expect(sideKey(goldSide)).toBe("p-1:2");
  });
});

describe("countPrintings", () => {
  it("counts a double-sided printing once", () => {
    expect(countPrintings([birdSide, goldSide, single])).toBe(2);
  });
});

describe("uniquePrintings", () => {
  it("keeps the first entry of each printing", () => {
    expect(uniquePrintings([birdSide, goldSide, single])).toEqual([birdSide, single]);
  });
});

describe("indexByPrinting", () => {
  it("answers with side 1 whatever the order", () => {
    expect(indexByPrinting([goldSide, birdSide]).get("p-1")).toBe(birdSide);
  });

  it("falls back to side 2 when side 1 is absent", () => {
    expect(indexByPrinting([goldSide]).get("p-1")).toBe(goldSide);
  });
});

describe("ownedTotalsByCard", () => {
  const owned = { "p-1": 2, "p-2": 3, "p-3": 1 };

  it("counts a Bird // Gold copy for both Bird and Gold", () => {
    const totals = ownedTotalsByCard([birdSide, goldSide, single], owned);
    expect(totals.get("bird")).toBe(3);
    expect(totals.get("gold")).toBe(2);
  });

  it("counts a Buff // Buff copy once for Buff", () => {
    expect(ownedTotalsByCard([buffFront, buffBack], owned).get("buff")).toBe(3);
  });

  it("treats a printing with no copies as zero", () => {
    expect(ownedTotalsByCard([single], {}).get("bird")).toBe(0);
  });
});
