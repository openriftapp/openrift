import { describe, expect, it } from "vitest";

import { coveredByPairPartner } from "./pair-copy-cover";

describe("coveredByPairPartner", () => {
  it("lets the card needing more copies pay for a shared printing", () => {
    expect(
      coveredByPairPartner([
        { cardId: "bird", printingId: "pair", amount: 1 },
        { cardId: "gold", printingId: "pair", amount: 2 },
        { cardId: "brush", printingId: "solo", amount: 3 },
      ]),
    ).toEqual([true, false, false]);
  });

  it("adds up a card's rows across zones before comparing", () => {
    expect(
      coveredByPairPartner([
        { cardId: "bird", printingId: "pair", amount: 2 },
        { cardId: "gold", printingId: "pair", amount: 2 },
        { cardId: "bird", printingId: "pair", amount: 1 },
      ]),
    ).toEqual([false, true, false]);
  });

  it("covers nothing without a shared printing or a price", () => {
    expect(
      coveredByPairPartner([
        { cardId: "bird", printingId: undefined, amount: 1 },
        { cardId: "gold", printingId: "pair", amount: 1 },
      ]),
    ).toEqual([false, false]);
  });
});
