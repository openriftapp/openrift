import { describe, expect, it } from "vitest";

import { cheapestPriceByCard, cheapestPricedPrinting, priceTotal } from "./card-price.js";
import { priceLookupFromMap } from "./price-lookup.js";

const prices = priceLookupFromMap({
  "p-en": { cardtrader: 300 },
  "p-en-cheap": { cardtrader: 250 },
  "p-zh": { cardtrader: 100 },
  "p-fr": { cardtrader: 200 },
});

const printing = (printingId: string, language: string) => ({ printingId, language });

describe("cheapestPricedPrinting", () => {
  it("takes the cheapest preferred-language printing even when another language is cheaper", () => {
    const result = cheapestPricedPrinting(
      [printing("p-zh", "ZH"), printing("p-en", "EN"), printing("p-en-cheap", "EN")],
      prices,
      "cardtrader",
      ["EN"],
    );

    expect(result).toEqual({ printing: printing("p-en-cheap", "EN"), price: 2.5 });
  });

  it("falls back to any language when no preferred printing is priced", () => {
    const result = cheapestPricedPrinting(
      [printing("p-unpriced", "EN"), printing("p-fr", "FR"), printing("p-zh", "ZH")],
      prices,
      "cardtrader",
      ["EN"],
    );

    expect(result?.printing.printingId).toBe("p-zh");
  });

  it("treats an empty language list as any language", () => {
    const result = cheapestPricedPrinting(
      [printing("p-en", "EN"), printing("p-zh", "ZH")],
      prices,
      "cardtrader",
      [],
    );

    expect(result?.printing.printingId).toBe("p-zh");
  });

  it("breaks a price tie by the lower printing id", () => {
    const tied = priceLookupFromMap({ "p-b": { cardmarket: 100 }, "p-a": { cardmarket: 100 } });

    const result = cheapestPricedPrinting(
      [printing("p-b", "EN"), printing("p-a", "EN")],
      tied,
      "cardmarket",
      ["EN"],
    );

    expect(result?.printing.printingId).toBe("p-a");
  });

  it("returns undefined when no printing is priced on the marketplace", () => {
    expect(
      cheapestPricedPrinting([printing("p-en", "EN")], prices, "tcgplayer", ["EN"]),
    ).toBeUndefined();
  });
});

describe("cheapestPriceByCard", () => {
  it("prices each card by the language rule and leaves out cards with no price", () => {
    const result = cheapestPriceByCard(
      new Map([
        ["card-a", [printing("p-zh", "ZH"), printing("p-en", "EN")]],
        ["card-b", [printing("p-unpriced", "EN")]],
      ]),
      prices,
      "cardtrader",
      ["EN"],
    );

    expect(result).toEqual(new Map([["card-a", 3]]));
  });
});

describe("priceTotal", () => {
  it("sums priced copies and counts unpriced copies separately", () => {
    expect(
      priceTotal([
        { price: 2, quantity: 3 },
        { price: undefined, quantity: 2 },
        { price: 0.5, quantity: 1 },
      ]),
    ).toEqual({ value: 6.5, priced: 4, unpriced: 2 });
  });

  it("is empty for no rows", () => {
    expect(priceTotal([])).toEqual({ value: 0, priced: 0, unpriced: 0 });
  });
});
