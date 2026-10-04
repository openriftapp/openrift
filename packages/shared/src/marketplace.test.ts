import { describe, expect, it } from "vitest";

import {
  affiliateUrl,
  cardmarketLangParam,
  cardnexusCartWizardUrl,
  cardtraderAffiliateUrl,
  MARKETPLACE_LINKS,
  marketplaceLabel,
  tcgplayerMassEntryUrl,
} from "./marketplace.js";

describe("affiliateUrl", () => {
  it("wraps the target URL in the TCGplayer partner redirect", () => {
    expect(affiliateUrl("https://www.tcgplayer.com/product/123")).toBe(
      "https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F123",
    );
  });

  it("encodes special characters in the wrapped URL", () => {
    expect(affiliateUrl("https://example.com/search?q=fire&page=1")).toContain(
      "u=https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dfire%26page%3D1",
    );
  });
});

describe("tcgplayerMassEntryUrl", () => {
  it("prefills Mass Entry with quantity-product entries for the Riftbound product line", () => {
    const url = new URL(
      tcgplayerMassEntryUrl([
        { productId: 652_993, quantity: 1 },
        { productId: 652_801, quantity: 2 },
      ]),
    );
    expect(url.origin).toBe("https://partner.tcgplayer.com");
    const target = new URL(url.searchParams.get("u") ?? "");
    expect(target.pathname).toBe("/massentry");
    expect(target.searchParams.get("productline")).toBe(
      "Riftbound League of Legends Trading Card Game",
    );
    expect(target.searchParams.get("c")).toBe("1-652993||2-652801");
  });
});

describe("cardnexusCartWizardUrl", () => {
  it("opens the Cart Wizard with quantity, language and finish per line", () => {
    expect(
      cardnexusCartWizardUrl([
        { productId: 151_339, quantity: 2, language: "FR", finish: "foil" },
        { productId: 151_160, quantity: 1, language: "EN", finish: "normal" },
      ]),
    ).toBe("https://af.cardnexus.link/7018965/products/cn/151339.2.fr.f~151160.1.en.s");
  });

  it("maps our Korean and Chinese codes to CardNexus language codes", () => {
    expect(
      cardnexusCartWizardUrl([
        { productId: 1, quantity: 1, language: "KR" },
        { productId: 2, quantity: 1, language: "SC" },
        { productId: 3, quantity: 1, language: "TC" },
        { productId: 4, quantity: 1, language: "ZH" },
      ]),
    ).toBe(
      "https://af.cardnexus.link/7018965/products/cn/1.1.ko~2.1.zh-Hans~3.1.zh-Hant~4.1.zh-Hans",
    );
  });

  it("leaves unknown finishes and missing languages empty so CardNexus accepts any", () => {
    expect(
      cardnexusCartWizardUrl([
        { productId: 7, quantity: 3, finish: "foil" },
        { productId: 8, quantity: 1, language: "DE", finish: "metal" },
        { productId: 9, quantity: 1 },
      ]),
    ).toBe("https://af.cardnexus.link/7018965/products/cn/7.3..f~8.1.de~9.1");
  });

  it("merges lines for the same product, language and finish", () => {
    expect(
      cardnexusCartWizardUrl([
        { productId: 7, quantity: 1, language: "EN", finish: "normal" },
        { productId: 7, quantity: 2, language: "EN", finish: "normal" },
        { productId: 7, quantity: 1, language: "FR", finish: "normal" },
      ]),
    ).toBe("https://af.cardnexus.link/7018965/products/cn/7.3.en.s~7.1.fr.s");
  });

  it("stops at the 400 lines the Cart Wizard reads", () => {
    const lines = Array.from({ length: 405 }, (_, index) => ({
      productId: index + 1,
      quantity: 1,
    }));
    const sent = cardnexusCartWizardUrl(lines).split("/cn/")[1]?.split("~") ?? [];
    expect(sent).toHaveLength(400);
    expect(sent.at(-1)).toBe("400.1");
  });
});

describe("cardtraderAffiliateUrl", () => {
  it("appends the share code with ? when the URL has no query", () => {
    expect(cardtraderAffiliateUrl("https://www.cardtrader.com/en/cards/9")).toBe(
      "https://www.cardtrader.com/en/cards/9?share_code=openrift",
    );
  });

  it("appends the share code with & when the URL already has a query", () => {
    expect(cardtraderAffiliateUrl("https://www.cardtrader.com/en/search?q=viktor")).toBe(
      "https://www.cardtrader.com/en/search?q=viktor&share_code=openrift",
    );
  });
});

describe("cardmarketLangParam", () => {
  it("returns empty string for null/undefined language", () => {
    expect(cardmarketLangParam(null)).toBe("");
    expect(cardmarketLangParam(undefined)).toBe("");
    expect(cardmarketLangParam("")).toBe("");
  });

  it("maps EN to language code 1", () => {
    expect(cardmarketLangParam("EN")).toBe("&language=1");
  });

  it("maps SC (our stored code) to simplified Chinese (6)", () => {
    expect(cardmarketLangParam("SC")).toBe("&language=6");
  });

  it("still maps the retired ZH code, for links shared before the SC rename", () => {
    expect(cardmarketLangParam("ZH")).toBe("&language=6");
  });

  it("also maps the explicit ZH-CN form to simplified Chinese (6)", () => {
    expect(cardmarketLangParam("ZH-CN")).toBe("&language=6");
  });

  it("maps ZH-TW to traditional Chinese (11)", () => {
    expect(cardmarketLangParam("ZH-TW")).toBe("&language=11");
  });

  it("maps TC (our stored code) to traditional Chinese (11)", () => {
    expect(cardmarketLangParam("TC")).toBe("&language=11");
  });

  it("maps KR (our stored code) to Korean (10)", () => {
    expect(cardmarketLangParam("KR")).toBe("&language=10");
  });

  it("is case-insensitive", () => {
    expect(cardmarketLangParam("en")).toBe("&language=1");
    expect(cardmarketLangParam("sc")).toBe("&language=6");
  });

  it("returns empty string for unknown languages rather than passing through", () => {
    expect(cardmarketLangParam("XX")).toBe("");
    expect(cardmarketLangParam("klingon")).toBe("");
  });
});

describe("MARKETPLACE_LINKS", () => {
  it("builds affiliate product links for TCGplayer and CardTrader", () => {
    expect(MARKETPLACE_LINKS.tcgplayer.productUrl(42)).toContain("partner.tcgplayer.com/openrift");
    expect(MARKETPLACE_LINKS.cardtrader.productUrl(42)).toContain("share_code=openrift");
  });

  it("builds Cardmarket product links with an optional language filter", () => {
    expect(MARKETPLACE_LINKS.cardmarket.productUrl(42)).toBe(
      "https://www.cardmarket.com/en/Riftbound/Products?idProduct=42",
    );
    expect(MARKETPLACE_LINKS.cardmarket.productUrl(42, "DE")).toBe(
      "https://www.cardmarket.com/en/Riftbound/Products?idProduct=42&language=3",
    );
  });

  it("builds CardNexus affiliate product links by CardNexus id", () => {
    expect(MARKETPLACE_LINKS.cardnexus.productUrl(151_339)).toBe(
      "https://af.cardnexus.link/7018965/cn/151339",
    );
  });

  it("keeps the Riftbound filter on CardNexus search inside the tracked redirect", () => {
    const url = new URL(MARKETPLACE_LINKS.cardnexus.searchUrl("Jinx, Rebel"));
    expect(url.origin + url.pathname).toBe("https://go.cardnexus.link/c/7018965/3770197/48046");
    const target = new URL(url.searchParams.get("u") ?? "");
    expect(target.searchParams.get("q")).toBe("Jinx, Rebel");
    expect(target.searchParams.get("game")).toBe("riftbound");
  });

  it("URL-encodes search queries", () => {
    expect(MARKETPLACE_LINKS.cardmarket.searchUrl("Viktor, Herald")).toContain(
      "searchString=Viktor%2C%20Herald",
    );
  });
});

describe("marketplaceLabel", () => {
  it("returns the full display label for known marketplaces", () => {
    expect(marketplaceLabel("tcgplayer")).toBe("TCGplayer");
    expect(marketplaceLabel("cardtrader")).toBe("CardTrader");
  });

  it("falls back to the raw value for unknown marketplaces", () => {
    expect(marketplaceLabel("mystery")).toBe("mystery");
  });
});
