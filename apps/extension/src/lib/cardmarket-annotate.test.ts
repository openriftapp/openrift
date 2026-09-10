import { describe, expect, it } from "vitest";

import { annotate, pillText, referencePriceText } from "./cardmarket-annotate";
import type { CardmarketFinish } from "./cardmarket-rows";
import type { OverlaySnapshot } from "./overlay-snapshot";

const SNAPSHOT: OverlaySnapshot = {
  lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" }],
  marketplace: "cardtrader",
  generatedAt: "2026-09-09T11:00:00.000Z",
  capturedAt: "2026-09-09T11:00:00.000Z",
  products: {
    "847321:normal": { owned: 2, wanted: 1, priceCents: 240 },
    "847321:foil": { owned: 3, wanted: 0, priceCents: null },
    "884017:normal": { owned: 0, wanted: 0, priceCents: 95 },
  },
};

interface RowSpec {
  id: number | undefined;
  finish?: CardmarketFinish;
}

function row({ id, finish = "normal" }: RowSpec, index: number): string {
  const thumbnail =
    id === undefined
      ? ""
      : `<span class="thumbnail-icon" data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/OGN/${id}/${id}.jpg&quot;&gt;"></span>`;
  const foil = finish === "foil" ? '<span class="st_SpecialIcon" aria-label="Foil"></span>' : "";
  return `<div id="stockRow${index}">${thumbnail}<div class="col-seller"><a href="/de/Riftbound/Products/Singles/Origins/Card">Card</a></div>${foil}<div class="col-offer"><div class="price-container"><span class="color-primary">1,00 €</span></div><div class="amount-container">1</div></div></div>`;
}

function pageWith(...rows: RowSpec[]): Document {
  const html = rows.map((spec, index) => row(spec, index)).join("");
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

function pills(doc: Document): string[] {
  return [...doc.querySelectorAll("[data-openrift-overlay]")].map((pill) => pill.textContent ?? "");
}

function prices(doc: Document): string[] {
  return [...doc.querySelectorAll("[data-openrift-overlay-price]")].map(
    (price) => price.textContent ?? "",
  );
}

describe("pillText", () => {
  it("reads both counts", () => {
    expect(pillText({ owned: 2, wanted: 1, priceCents: null })).toBe("own 2 · want 1");
  });
});

describe("referencePriceText", () => {
  it("labels the marketplace and formats its own currency", () => {
    expect(referencePriceText("cardtrader", 240, "en-US")).toBe("CT €2.40");
    expect(referencePriceText("tcgplayer", 1999, "en-US")).toBe("TCG $19.99");
    expect(referencePriceText("cardmarket", 5, "en-US")).toBe("CM €0.05");
  });
});

describe("annotate", () => {
  it("puts a pill in a cell at the end of every covered row", () => {
    const doc = pageWith({ id: 847_321 }, { id: 847_321, finish: "foil" });

    expect(annotate(doc, SNAPSHOT, doc)).toBe(2);
    expect(pills(doc)).toEqual(["own 2 · want 1", "own 3 · want 0"]);
    const first = doc.querySelector("#stockRow0");
    expect(first?.lastElementChild?.matches("[data-openrift-cell]")).toBe(true);
    expect(first?.lastElementChild?.querySelector("[data-openrift-overlay]")).not.toBeNull();
  });

  it("puts the reference price below the seller's price, once", () => {
    const doc = pageWith({ id: 847_321 });

    annotate(doc, SNAPSHOT, doc);
    annotate(doc, SNAPSHOT, doc);

    expect(prices(doc)).toHaveLength(1);
    expect(prices(doc)[0]).toMatch(/^CT /u);
    const container = doc.querySelector<HTMLElement>(".price-container");
    expect(container?.lastElementChild?.matches("[data-openrift-overlay-price]")).toBe(true);
    expect(container?.style.flexWrap).toBe("wrap");
    expect(doc.querySelector("[data-openrift-cell] [data-openrift-overlay-price]")).toBeNull();
  });

  it("prices a row it holds no counts for", () => {
    const doc = pageWith({ id: 884_017 });

    expect(annotate(doc, SNAPSHOT, doc)).toBe(0);
    expect(pills(doc)).toEqual([]);
    expect(prices(doc)).toHaveLength(1);
  });

  it("leaves a row with no price unpriced", () => {
    const doc = pageWith({ id: 847_321, finish: "foil" });

    annotate(doc, SNAPSHOT, doc);

    expect(prices(doc)).toEqual([]);
  });

  it("leaves rows the snapshot does not cover alone", () => {
    const doc = pageWith({ id: 7 });

    expect(annotate(doc, SNAPSHOT, doc)).toBe(0);
    expect(pills(doc)).toEqual([]);
    expect(prices(doc)).toEqual([]);
  });

  it("leaves rows with no resolvable product alone", () => {
    const doc = pageWith({ id: undefined });

    expect(annotate(doc, SNAPSHOT, doc)).toBe(0);
    expect(pills(doc)).toEqual([]);
  });

  it("updates in place when it runs again", () => {
    const doc = pageWith({ id: 847_321 });
    annotate(doc, SNAPSHOT, doc);

    const changed: OverlaySnapshot = {
      ...SNAPSHOT,
      products: { "847321:normal": { owned: 4, wanted: 0, priceCents: 300 } },
    };
    expect(annotate(doc, changed, doc)).toBe(1);
    expect(pills(doc)).toEqual(["own 4 · want 0"]);
    expect(prices(doc)[0]).toMatch(/3\.00|3,00/u);
  });

  it("greens an ask at or under the reference, over Cardmarket's own rule", () => {
    const doc = pageWith({ id: 847_321 });

    // The fixture asks 1,00 € against a 2,40 € reference.
    annotate(doc, SNAPSHOT, doc);

    const ask = doc.querySelector<HTMLElement>(".color-primary");
    expect(ask?.style.color).toBe("rgb(21, 128, 61)");
    expect(ask?.style.getPropertyPriority("color")).toBe("important");
  });

  it("leaves its own chip unpainted: the ask is what carries the verdict", () => {
    const doc = pageWith({ id: 847_321 });

    annotate(doc, SNAPSHOT, doc);

    expect(doc.querySelector<HTMLElement>("[data-openrift-overlay-price]")?.style.color).toBe("");
  });

  it("ambers an ask up to a fifth over the reference", () => {
    const doc = pageWith({ id: 847_321 });
    const near: OverlaySnapshot = {
      ...SNAPSHOT,
      products: { "847321:normal": { owned: 1, wanted: 0, priceCents: 90 } },
    };

    annotate(doc, near, doc);

    expect(doc.querySelector<HTMLElement>(".color-primary")?.style.color).toBe("rgb(161, 98, 7)");
  });

  it("reds an ask more than a fifth over the reference", () => {
    const doc = pageWith({ id: 847_321 });
    const dear: OverlaySnapshot = {
      ...SNAPSHOT,
      products: { "847321:normal": { owned: 1, wanted: 0, priceCents: 50 } },
    };

    annotate(doc, dear, doc);

    expect(doc.querySelector<HTMLElement>(".color-primary")?.style.color).toBe("rgb(185, 28, 28)");
  });

  it("never compares a dollar reference against a euro ask", () => {
    const doc = pageWith({ id: 847_321 });

    annotate(doc, { ...SNAPSHOT, marketplace: "tcgplayer" }, doc);

    expect(doc.querySelector<HTMLElement>(".color-primary")?.style.color).toBe("");
  });

  it("takes its colour back when a later snapshot agrees with the ask", () => {
    const doc = pageWith({ id: 847_321 });
    annotate(doc, SNAPSHOT, doc);

    annotate(doc, { ...SNAPSHOT, products: {} }, doc);

    expect(doc.querySelector<HTMLElement>(".color-primary")?.style.color).toBe("");
  });

  it("removes a stale pill and price when the new snapshot drops the product", () => {
    const doc = pageWith({ id: 847_321 });
    annotate(doc, SNAPSHOT, doc);

    annotate(doc, { ...SNAPSHOT, products: {} }, doc);
    expect(pills(doc)).toEqual([]);
    expect(prices(doc)).toEqual([]);
  });
});
