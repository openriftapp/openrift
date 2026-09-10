import { describe, expect, it } from "vitest";

import {
  deckImportUrl,
  isOverlaySyncUrl,
  matchPatternForUrl,
  openriftMatchPattern,
  overlaySyncUrl,
  picksImportUrl,
} from "./openrift-url";

describe("picksImportUrl", () => {
  it("carries the JSON payload in the fragment, URL-encoded", () => {
    const url = picksImportUrl({
      v: 1,
      seller: "Some One",
      picks: [
        {
          idProduct: 847_321,
          finish: "foil",
          idLanguage: 1,
          languageLabel: "Englisch",
          productName: "Volibear, Imposing",
          quantity: 2,
        },
      ],
    });

    const [base, fragment] = url.split("#");
    expect(base).toBe("https://openrift.app/collections/lists/import/cardmarket");
    expect(fragment?.startsWith("picks=")).toBe(true);
    expect(JSON.parse(decodeURIComponent(fragment?.slice("picks=".length) ?? ""))).toMatchObject({
      v: 1,
      seller: "Some One",
    });
  });
});

describe("deckImportUrl", () => {
  it("URL-encodes the payload into the code param", () => {
    expect(deckImportUrl("Legend:\n1 Ekko")).toBe(
      "https://openrift.app/decks/import?code=Legend%3A%0A1%20Ekko",
    );
  });

  it("appends an encoded name param when a deck name is given", () => {
    expect(deckImportUrl("CODE123456789ABC", { name: "Diana, Scorn of the Moon" })).toBe(
      "https://openrift.app/decks/import?code=CODE123456789ABC&name=Diana%2C%20Scorn%20of%20the%20Moon",
    );
  });

  it("appends an encoded source param when the page can be a deck link", () => {
    expect(
      deckImportUrl("CODE123456789ABC", { source: "https://riftdecks.com/deck/42?id=7" }),
    ).toBe(
      "https://openrift.app/decks/import?code=CODE123456789ABC&source=https%3A%2F%2Friftdecks.com%2Fdeck%2F42%3Fid%3D7",
    );
  });

  it("omits the optional params when nothing rides along", () => {
    const url = deckImportUrl("CODE123456789ABC");
    expect(url).not.toContain("name=");
    expect(url).not.toContain("source=");
  });
});

describe("isOverlaySyncUrl", () => {
  it("matches the sync page on the configured instance", () => {
    expect(isOverlaySyncUrl("https://openrift.app/extension/cardmarket")).toBe(true);
  });

  it("keeps out other pages and other hosts", () => {
    expect(isOverlaySyncUrl("https://openrift.app/extension")).toBe(false);
    expect(isOverlaySyncUrl("https://openrift.app.evil.test/extension/cardmarket")).toBe(false);
    expect(isOverlaySyncUrl("not a url")).toBe(false);
  });
});

describe("openriftMatchPattern", () => {
  it("covers the whole instance origin", () => {
    expect(openriftMatchPattern()).toBe("https://openrift.app/*");
  });
});

describe("matchPatternForUrl", () => {
  it("drops the port, which no match pattern may carry", () => {
    expect(matchPatternForUrl("https://localhost:5174")).toBe("https://localhost/*");
  });

  it("drops any path as well", () => {
    expect(matchPatternForUrl("https://openrift.app/extension/cardmarket")).toBe(
      "https://openrift.app/*",
    );
  });

  it("keeps the scheme it was given", () => {
    expect(matchPatternForUrl("http://localhost:3000")).toBe("http://localhost/*");
  });
});

describe("overlaySyncUrl", () => {
  it("points at the sync page", () => {
    expect(overlaySyncUrl()).toBe("https://openrift.app/extension/cardmarket");
  });
});
