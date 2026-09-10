import { describe, expect, it } from "vitest";

import { pickClick, renderPickControls } from "./cardmarket-pick-controls";
import { adjustPick, emptyBasket } from "./picks";

function row(id: number | undefined, index: number, language = "Englisch"): string {
  const thumbnail =
    id === undefined
      ? ""
      : `<span class="thumbnail-icon" data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/OGN/${id}/${id}.jpg&quot;&gt;"></span>`;
  return `<div id="stockRow${index}">${thumbnail}<div class="col-seller"><a href="/de/Riftbound/Products/Singles/Origins/Card">Card ${index}</a><span data-openrift-overlay>own 1 · want 2</span></div><span class="icon" aria-label="${language}"></span></div>`;
}

function pageWith(...ids: (number | undefined)[]): Document {
  const html = ids.map((id, index) => row(id, index)).join("");
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

function counts(doc: Document): string[] {
  return [...doc.querySelectorAll("[data-openrift-pick-count]")].map((el) => el.textContent ?? "");
}

const CARD_0 = {
  idProduct: 847_321,
  finish: "normal" as const,
  idLanguage: 1,
  languageLabel: "Englisch",
  productName: "Card 0",
};

describe("renderPickControls", () => {
  it("adds a control in the row's cell on every row with a product id and shows the picked count", () => {
    const doc = pageWith(847_321, undefined, 847_358);
    const basket = adjustPick(emptyBasket(), "seller", CARD_0, 3);

    expect(renderPickControls(doc, basket, "seller", doc)).toBe(2);
    expect(counts(doc)).toEqual(["3", "0"]);
    const cell = doc.querySelector("#stockRow0 > [data-openrift-cell]");
    expect(cell?.querySelector("[data-openrift-pick]")).not.toBeNull();
    expect(doc.querySelector("#stockRow1 [data-openrift-cell]")).toBeNull();
  });

  it("repaints an existing control on a second pass without duplicating it", () => {
    const doc = pageWith(847_321);
    renderPickControls(doc, emptyBasket(), "seller", doc);
    renderPickControls(doc, adjustPick(emptyBasket(), "seller", CARD_0, 1), "seller", doc);

    expect(doc.querySelectorAll("[data-openrift-pick]")).toHaveLength(1);
    expect(counts(doc)).toEqual(["1"]);
  });

  it("disables the minus button at zero", () => {
    const doc = pageWith(847_321);
    renderPickControls(doc, emptyBasket(), "seller", doc);

    const less = doc.querySelector<HTMLButtonElement>('[data-openrift-pick-delta="-1"]');
    expect(less?.disabled).toBe(true);
  });
});

describe("pickClick", () => {
  it("reads the pick and the direction back off the clicked button", () => {
    const doc = pageWith(847_321);
    renderPickControls(doc, emptyBasket(), "seller", doc);

    const more = doc.querySelector('[data-openrift-pick-delta="1"]');
    expect(pickClick(more)).toEqual({ delta: 1, identity: CARD_0 });
  });

  it("keeps an unplaced language as null", () => {
    const html = row(847_321, 0, "Foil");
    const doc = new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
    renderPickControls(doc, emptyBasket(), "seller", doc);

    const less = doc.querySelector('[data-openrift-pick-delta="-1"]');
    expect(pickClick(less)).toEqual({
      delta: -1,
      identity: { ...CARD_0, idLanguage: null, languageLabel: null },
    });
  });

  it("ignores clicks anywhere else", () => {
    const doc = pageWith(847_321);
    renderPickControls(doc, emptyBasket(), "seller", doc);

    expect(pickClick(doc.querySelector("a"))).toBeUndefined();
    expect(pickClick(null)).toBeUndefined();
  });
});
