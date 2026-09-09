import { describe, expect, it } from "vitest";

import { isCardmarketOffersUrl } from "./cardmarket-url";

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
