import { describe, expect, it } from "vitest";

import type { WizardLine } from "./wizard-split";
import {
  cardtraderZeroShippingCents,
  lineCount,
  needsAttributeNote,
  sellerSummaryText,
  splitWizardLines,
  totalsText,
  wantsText,
} from "./wizard-split";

function line(overrides: Partial<WizardLine> = {}): WizardLine {
  return {
    seller: "s1",
    idProduct: 866_920,
    finish: "normal",
    idLanguage: 1,
    languageLabel: "English",
    productName: "Undertitan",
    quantity: 1,
    cardmarketCents: 100,
    cardtraderCents: 80,
    ...overrides,
  };
}

const SHIPPING = new Map([
  ["s1", 125],
  ["s2", 180],
]);

describe("cardtraderZeroShippingCents", () => {
  it("picks the tier by card count", () => {
    expect(cardtraderZeroShippingCents(1)).toBe(1890);
    expect(cardtraderZeroShippingCents(494)).toBe(1890);
    expect(cardtraderZeroShippingCents(495)).toBe(2640);
    expect(cardtraderZeroShippingCents(2000)).toBe(5430);
    expect(cardtraderZeroShippingCents(30_000)).toBe(8440);
  });
});

describe("splitWizardLines", () => {
  it("moves a line CardTrader undercuts and keeps a seller whose rest saves more than shipping", () => {
    const cheaper = line({ cardtraderCents: 80 });
    const dearer = line({
      productName: "Guardian Angel",
      cardmarketCents: 100,
      cardtraderCents: 300,
    });

    const split = splitWizardLines([cheaper, dearer], SHIPPING);

    expect(split.cardtrader).toEqual([cheaper]);
    expect(split.cardmarket).toEqual([dearer]);
    expect(split.sellers[0]).toMatchObject({ seller: "s1", kept: true, savingCents: 200 });
    expect(split.wizardCents).toBe(200);
    expect(split.cardtraderAllCents).toBe(380);
    expect(split.cardmarketCents).toBe(100);
    expect(split.cardtraderCents).toBe(80);
  });

  it("drops a seller whose kept cards save less than their shipping", () => {
    const cheaper = line({ cardtraderCents: 80 });
    const barely = line({
      productName: "Guardian Angel",
      cardmarketCents: 100,
      cardtraderCents: 140,
    });

    const split = splitWizardLines([cheaper, barely], SHIPPING);

    expect(split.cardmarket).toEqual([]);
    expect(split.cardtrader).toEqual([cheaper, barely]);
    expect(split.sellers[0]).toMatchObject({ kept: false, savingCents: 40, shippingCents: 125 });
    expect(split.cardtraderCents).toBe(220);
  });

  it("keeps a seller pinned by a card with no CardTrader price, and a tie stays there", () => {
    const tie = line({ cardtraderCents: 100 });
    const unpriced = line({ productName: "Heart of Dark Ice", cardtraderCents: null });

    const split = splitWizardLines([tie, unpriced], SHIPPING);

    expect(split.cardtrader).toEqual([]);
    expect(split.cardmarket).toEqual([tie, unpriced]);
    expect(split.unpriced).toBe(1);
    expect(split.sellers[0]).toMatchObject({ kept: true, unpriced: 1 });
    expect(split.cardtraderAllCents).toBe(100);
  });

  it("keeps a seller whose shipping is unknown, but cannot total that way", () => {
    const split = splitWizardLines([line({ cardtraderCents: 101 })], new Map());

    expect(split.sellers[0]).toMatchObject({ kept: true, shippingCents: undefined });
    expect(split.totals).toEqual({
      cardmarket: undefined,
      cardtrader: 101,
      split: undefined,
    });
    expect(split.winner).toBe("cardtrader");
    expect(split.cardtrader).toHaveLength(1);
  });

  it("hands every line to the winner when a whole shop is cheapest", () => {
    const lines = [
      line({ seller: "s1", cardmarketCents: 100, cardtraderCents: 90 }),
      line({
        seller: "s2",
        productName: "Guardian Angel",
        cardmarketCents: 100,
        cardtraderCents: 300,
      }),
    ];

    const withFee = splitWizardLines(lines, SHIPPING, true);
    expect(withFee.winner).toBe("cardmarket");
    expect(withFee.cardmarket).toEqual(lines);
    expect(withFee.cardtrader).toEqual([]);

    const withoutFee = splitWizardLines(lines, SHIPPING, false);
    expect(withoutFee.winner).toBe("split");
    expect(withoutFee.cardtrader.map((entry) => entry.seller)).toEqual(["s1"]);
  });

  it("decides each seller on its own and multiplies by quantity", () => {
    const split = splitWizardLines(
      [
        line({ seller: "s1", quantity: 3, cardmarketCents: 100, cardtraderCents: 150 }),
        line({
          seller: "s2",
          productName: "Guardian Angel",
          cardmarketCents: 100,
          cardtraderCents: 110,
        }),
      ],
      SHIPPING,
    );

    expect(split.sellers.map((decision) => decision.kept)).toEqual([true, false]);
    expect(split.cardmarketCents).toBe(300);
    expect(split.cardtraderCents).toBe(110);
  });

  it("is empty for no lines", () => {
    expect(splitWizardLines([])).toMatchObject({
      cardmarket: [],
      cardtrader: [],
      sellers: [],
      unpriced: 0,
      wizardCents: 0,
    });
  });
});

describe("wantsText", () => {
  it("merges by name, sorts and writes the wizard's own format", () => {
    expect(
      wantsText([
        line({ productName: "Undertitan", quantity: 2 }),
        line({ productName: "Guardian Angel" }),
        line({ productName: "Undertitan", quantity: 1 }),
      ]),
    ).toBe("1x Guardian Angel\n3x Undertitan");
  });

  it("is empty for no lines", () => {
    expect(wantsText([])).toBe("");
  });
});

describe("needsAttributeNote", () => {
  it("is set for a foil or a non-English line only", () => {
    expect(needsAttributeNote([line()])).toBe(false);
    expect(needsAttributeNote([line({ idLanguage: null })])).toBe(false);
    expect(needsAttributeNote([line({ finish: "foil" })])).toBe(true);
    expect(needsAttributeNote([line({ idLanguage: 3 })])).toBe(true);
  });
});

describe("lineCount", () => {
  it("sums quantities", () => {
    expect(lineCount([line({ quantity: 2 }), line()])).toBe(3);
  });
});

describe("sellerSummaryText", () => {
  it("explains a kept seller with what the cards save", () => {
    const [decision] = splitWizardLines(
      [
        line({ cardtraderCents: 80 }),
        line({ productName: "Guardian Angel", cardmarketCents: 100, cardtraderCents: 300 }),
      ],
      SHIPPING,
    ).sellers;

    expect(sellerSummaryText(decision!, "split", "en-US")).toBe(
      "Keep 1 card here: they save €2.00 against €1.25 shipping. 1 card cheaper on CardTrader, moved.",
    );
    expect(sellerSummaryText(decision!, "cardmarket")).toMatch(/^Whole order stays on Cardmarket/u);
    expect(sellerSummaryText(decision!, "cardtrader")).toMatch(/^Whole order goes to CardTrader/u);
  });

  it("explains a skipped seller", () => {
    const [decision] = splitWizardLines(
      [
        line({ cardtraderCents: 80 }),
        line({ productName: "Guardian Angel", cardmarketCents: 100, cardtraderCents: 140 }),
      ],
      SHIPPING,
    ).sellers;

    expect(sellerSummaryText(decision!, "split", "en-US")).toBe(
      "Skip this seller: all 2 cards on CardTrader for €2.20. Keeping the cheaper ones here would save €0.40 against €1.25 shipping.",
    );
  });

  it("names the unpriced card that pins a seller", () => {
    const [decision] = splitWizardLines(
      [line({ cardtraderCents: null }), line({ productName: "Guardian Angel" })],
      SHIPPING,
    ).sellers;

    expect(sellerSummaryText(decision!, "split", "en-US")).toBe(
      "Keep 1 card here: 1 card with no CardTrader price. 1 card cheaper on CardTrader, moved.",
    );
  });

  it("is empty for a seller without lines", () => {
    expect(
      sellerSummaryText(
        {
          seller: "x",
          kept: false,
          shippingCents: 0,
          savingCents: 0,
          unpriced: 0,
          cardmarket: [],
          cardtrader: [],
        },
        "split",
      ),
    ).toBe("");
  });
});

describe("totalsText", () => {
  const lines = [
    line({ seller: "s1", quantity: 2, cardmarketCents: 100, cardtraderCents: 60 }),
    line({
      seller: "s2",
      productName: "Guardian Angel",
      cardmarketCents: 100,
      cardtraderCents: 400,
    }),
    line({ seller: "s2", productName: "Heart of Dark Ice", cardtraderCents: 90 }),
  ];

  it("totals all three ways with shipping and names the cheapest", () => {
    // s1 moves entirely (saves nothing there), s2 keeps Guardian Angel (saves 3.00 > 1.80).
    const split = splitWizardLines(lines, SHIPPING, true);

    expect(totalsText(split, "en-US")).toEqual({
      allCardmarket: "All on Cardmarket: €4.00 + €3.05 shipping from 2 sellers for 4 cards = €7.05",
      allCardtrader: "All on CardTrader: €6.10 + €18.90 Zero shipping for 4 cards = €25.00",
      best: "Best: all on Cardmarket, €16.75 under a mix.",
      unpriced: undefined,
    });
    expect(split.cardmarket).toHaveLength(3);
  });

  it("leaves the Zero fee out when told to", () => {
    const totals = totalsText(splitWizardLines(lines, SHIPPING, false), "en-US");

    expect(totals.allCardtrader).toBe("All on CardTrader: €6.10 for 4 cards = €6.10");
    expect(totals.best).toBe(
      "Best: a mix, €1.20 under all on CardTrader. Cardmarket €1.00 + €1.80 shipping from 1 seller for 1 card, CardTrader €2.10 for 3 cards = €4.90.",
    );
  });

  it("cannot total all-on-CardTrader while a card has no price there", () => {
    const totals = totalsText(
      splitWizardLines(
        [...lines, line({ seller: "s2", productName: "Mystery", cardtraderCents: null })],
        SHIPPING,
      ),
      "en-US",
    );

    expect(totals.allCardtrader).toBe("All on CardTrader: €6.10 for 4 of 5 cards");
    expect(totals.unpriced).toBe(
      "1 card without a CardTrader price, counted on the Cardmarket side.",
    );
    expect(totals.best).toMatch(/^Best: (?<winner>a mix|all on Cardmarket)/u);
  });

  it("never reports a mix above both extremes", () => {
    const totals = totalsText(
      splitWizardLines(
        [line({ seller: "s1", cardtraderCents: 80 }), line({ seller: "s2", cardtraderCents: 90 })],
        SHIPPING,
        true,
      ),
      "en-US",
    );

    expect(totals.best).toBe("Best: all on Cardmarket, €15.55 under all on CardTrader.");
  });

  it("says plus shipping when a seller's estimate is missing and cannot pick a winner", () => {
    const totals = totalsText(splitWizardLines(lines, new Map([["s1", 125]])), "en-US");

    expect(totals.allCardmarket).toBe(
      "All on Cardmarket: €4.00 plus shipping from 2 sellers for 4 cards",
    );
    expect(totals.best).toBe("Best: all on CardTrader.");
  });

  it("measures the margin against the next distinct total when the mix ties a shop", () => {
    const totals = totalsText(
      splitWizardLines(
        [line({ seller: "s1", cardtraderCents: 80 }), line({ seller: "s2", cardtraderCents: 90 })],
        SHIPPING,
        false,
      ),
      "en-US",
    );

    // All on CardTrader and the mix are both 1.70; all on Cardmarket is 2.00 + 3.05.
    expect(totals.best).toBe("Best: all on CardTrader, €3.35 under all on Cardmarket.");
  });
});
