import { describe, expect, it } from "vitest";

import {
  cardmarketPageKind,
  cardmarketSellerFromUrl,
  isCardmarketOffersUrl,
  isCardmarketWizardResultUrl,
} from "./cardmarket-url";

describe("cardmarketSellerFromUrl", () => {
  it("reads the seller out of an offers page", () => {
    expect(
      cardmarketSellerFromUrl(
        "https://www.cardmarket.com/de/Riftbound/Users/Some%20One/Offers/Singles?page=2",
      ),
    ).toBe("Some One");
  });

  it("is undefined off an offers page", () => {
    expect(
      cardmarketSellerFromUrl("https://www.cardmarket.com/de/Riftbound/Users/someone"),
    ).toBeUndefined();
  });
});

describe("isCardmarketOffersUrl", () => {
  it("matches a seller's singles offers in any interface language", () => {
    expect(
      isCardmarketOffersUrl("https://www.cardmarket.com/de/Riftbound/Users/someone/Offers/Singles"),
    ).toBe(true);
    expect(
      isCardmarketOffersUrl("https://www.cardmarket.com/en/Riftbound/Users/someone/Offers"),
    ).toBe(true);
  });

  it("keeps out other games", () => {
    expect(
      isCardmarketOffersUrl("https://www.cardmarket.com/de/Magic/Users/someone/Offers/Singles"),
    ).toBe(false);
  });

  it("keeps out other Cardmarket pages", () => {
    expect(
      isCardmarketOffersUrl(
        "https://www.cardmarket.com/de/Riftbound/Products/Singles/Origins/Card",
      ),
    ).toBe(false);
    expect(isCardmarketOffersUrl("https://www.cardmarket.com/de/Riftbound/Users/someone")).toBe(
      false,
    );
  });

  it("keeps out look-alike hosts", () => {
    expect(
      isCardmarketOffersUrl("https://cardmarket.com.evil.test/de/Riftbound/Users/x/Offers/Singles"),
    ).toBe(false);
  });

  it("reads a non-URL as no match", () => {
    expect(isCardmarketOffersUrl("about:blank")).toBe(false);
  });
});

describe("cardmarketPageKind", () => {
  const WIZARD =
    "https://www.cardmarket.com/en/Riftbound/Wants/ShoppingWizard/Results/2026-9-993256028-6aa66d4a194f6";

  it("tells a wizard result from an offers page", () => {
    expect(cardmarketPageKind(WIZARD)).toBe("wizard");
    expect(isCardmarketWizardResultUrl(WIZARD)).toBe(true);
    expect(
      cardmarketPageKind("https://www.cardmarket.com/de/Riftbound/Users/someone/Offers/Singles"),
    ).toBe("offers");
  });

  it("keeps out the wizard's own setup and history pages", () => {
    expect(
      cardmarketPageKind("https://www.cardmarket.com/en/Riftbound/Wants/ShoppingWizard"),
    ).toBeUndefined();
    expect(
      cardmarketPageKind("https://www.cardmarket.com/en/Riftbound/Wants/ShoppingWizard/Results"),
    ).toBeUndefined();
  });

  it("keeps out another game's wizard", () => {
    expect(
      cardmarketPageKind(
        "https://www.cardmarket.com/en/Magic/Wants/ShoppingWizard/Results/2026-9-1-abc",
      ),
    ).toBeUndefined();
  });
});
