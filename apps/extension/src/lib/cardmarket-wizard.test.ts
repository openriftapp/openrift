import { describe, expect, it } from "vitest";

import { annotate } from "./cardmarket-annotate";
import { extractWizardRows } from "./cardmarket-rows";
import {
  isPickAllClick,
  relayoutSellerCards,
  renderWizardPanel,
  sellerShipping,
  wizardLines,
  zeroShippingToggle,
} from "./cardmarket-wizard";
import type { OverlaySnapshot } from "./overlay-snapshot";

const SNAPSHOT: OverlaySnapshot = {
  lists: [{ id: "0199a0f2-0000-7000-8000-000000000001", name: "Summoner Skirmish wants" }],
  generatedAt: "2026-09-09T11:00:00.000Z",
  capturedAt: "2026-09-09T11:00:00.000Z",
  products: {
    "866920:foil": { owned: 0, wanted: 2, cardtraderCents: 20 },
    "866779:normal": { owned: 1, wanted: 0, cardtraderCents: 150 },
  },
};

function wizardRow(article: number, product: number, name: string, qty: number, price: string) {
  return `<tr><td><input type="checkbox" data-id-article="${article}"></td><td><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/SFD/${product}/${product}.jpg&quot;&gt;"></span></td><td>${qty}</td><td class="card-name">${name}</td><td></td><td><span class="icon" aria-label="English"></span></td><td></td><td><span class="extras">${product === 866_920 ? '<span class="icon" aria-label="Foil"></span>' : ""}</span></td><td class="text-end">${price}</td></tr>`;
}

function card(rows: string, shipping = "1,25 €", id = "DetailedResult1"): string {
  return `<div id="${id}" class="card detailed-result-card"><div class="card-body"><dl class="row"><dt><span class="fonticon-money"></span><span>Articles Value</span></dt><dd>1,50 €</dd><dt><span class="fonticon-shipping-methods"></span><span>Versandkosten</span></dt><dd>${shipping}</dd></dl><hr><table><thead><tr><th>Price</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function pageWith(cards: string[]): Document {
  const html = `<div id="ShoppingWizardResult"><dl></dl></div>${cards.join("")}`;
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

const PAGE = () =>
  pageWith([
    card(wizardRow(1, 866_920, "Undertitan", 2, "0,35 €"), "1,25 €", "DetailedResult1"),
    card(wizardRow(2, 866_779, "Heart of Dark Ice", 1, "1,20 €"), "1,80 €", "DetailedResult2"),
  ]);

describe("wizardLines", () => {
  it("pairs each priced row with the snapshot's CardTrader price", () => {
    const doc = PAGE();

    const lines = wizardLines(extractWizardRows(doc), SNAPSHOT);

    expect(lines).toEqual([
      {
        seller: "DetailedResult1",
        idProduct: 866_920,
        finish: "foil",
        idLanguage: 1,
        languageLabel: "English",
        productName: "Undertitan",
        quantity: 2,
        cardmarketCents: 35,
        cardtraderCents: 20,
      },
      {
        seller: "DetailedResult2",
        idProduct: 866_779,
        finish: "normal",
        idLanguage: 1,
        languageLabel: "English",
        productName: "Heart of Dark Ice",
        quantity: 1,
        cardmarketCents: 120,
        cardtraderCents: 150,
      },
    ]);
  });

  it("leaves out a row with no product or no price", () => {
    const doc = pageWith([
      card(
        `<tr><td><input type="checkbox" data-id-article="1"></td><td></td><td>1</td><td class="card-name">Mystery</td><td></td><td></td><td></td><td></td><td class="text-end">1,00 €</td></tr>`,
      ),
    ]);

    expect(wizardLines(extractWizardRows(doc), SNAPSHOT)).toEqual([]);
  });
});

describe("relayoutSellerCards", () => {
  it("fires a resize on the page's window", () => {
    // A DOMParser document has no window; the live one does.
    let resized = 0;
    window.addEventListener("resize", () => {
      resized += 1;
    });

    relayoutSellerCards(document);

    expect(resized).toBe(1);
  });
});

describe("wizard rows after annotation", () => {
  it("still reads the price once the OpenRift cell sits behind it", () => {
    const doc = PAGE();

    annotate(doc, SNAPSHOT, doc);
    const rows = extractWizardRows(doc);

    expect(rows.map((row) => row.priceCents)).toEqual([35, 120]);
    expect(doc.querySelector<HTMLElement>("td.text-end")?.style.whiteSpace).toBe("nowrap");
    const cell = doc.querySelector<HTMLElement>("tbody [data-openrift-cell]");
    expect(cell?.tagName).toBe("TD");
    expect(cell?.style.display).toBe("");
    expect(cell?.firstElementChild?.querySelector("[data-openrift-overlay-price]")).not.toBeNull();
    expect(doc.querySelectorAll("[data-openrift-cell] [data-openrift-overlay-price]")).toHaveLength(
      2,
    );
    expect(doc.querySelector<HTMLElement>("td.text-end")?.style.color).not.toBe("");
  });
});

describe("sellerShipping", () => {
  it("reads each card's shipping estimate by the icon, whatever the label says", () => {
    const doc = PAGE();

    expect([...sellerShipping(doc)]).toEqual([
      ["DetailedResult1", 125],
      ["DetailedResult2", 180],
    ]);
  });

  it("leaves a card without a shipping row undefined", () => {
    const doc = pageWith([
      `<div id="x" class="detailed-result-card"><dl></dl><table><tbody></tbody></table></div>`,
    ]);

    expect([...sellerShipping(doc)]).toEqual([["x", undefined]]);
  });
});

describe("renderWizardPanel", () => {
  it("adds the panel to the summary once and fills both lists", () => {
    const doc = PAGE();

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc);
    const split = renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc);

    expect(doc.querySelectorAll("[data-openrift-wizard]")).toHaveLength(1);
    // Both sellers would be skipped, but the 18,90 Zero fee makes all on Cardmarket cheapest.
    expect(split?.winner).toBe("cardmarket");
    expect(split?.cardtrader).toEqual([]);
    const areas = [...doc.querySelectorAll<HTMLTextAreaElement>("[data-openrift-wizard] textarea")];
    expect(areas.map((area) => area.value)).toEqual(["1x Heart of Dark Ice\n2x Undertitan", ""]);
    expect(
      doc.querySelector('[data-openrift-wizard-part="cardtrader"] [data-role="label"]')
        ?.textContent,
    ).toBe("Buy on CardTrader (0 cards)");
    expect(
      doc.querySelector('[data-openrift-wizard-part="cardmarket"] [data-role="allCardmarket"]'),
    ).not.toBeNull();
  });

  it("writes the totals and the attribute note for a moved foil", () => {
    const doc = PAGE();

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc);

    // All on Cardmarket: 1,90 + 1,25 + 1,80 shipping = 4,95. All on CardTrader: 1,90 + 18,90 Zero fee.
    expect(doc.querySelector('[data-role="allCardmarket"]')?.textContent).toMatch(/4[.,]95/u);
    expect(doc.querySelector('[data-role="allCardtrader"]')?.textContent).toMatch(/20[.,]80/u);
    expect(doc.querySelector('[data-role="best"]')?.textContent).toMatch(
      /^Best: all on Cardmarket/u,
    );
    expect(doc.querySelector('[data-role="cheapest"]')).toBeNull();
    expect(
      doc.querySelector<HTMLInputElement>("[data-openrift-wizard-zero-shipping]")?.checked,
    ).toBe(true);
    // The foil stays with the winner, all on Cardmarket, so that column carries the note.
    const note = doc.querySelector<HTMLElement>(
      '[data-openrift-wizard-part="cardmarket"] [data-role="note"]',
    );
    expect(note?.hidden).toBe(false);
    expect(doc.querySelector<HTMLElement>('[data-role="unpriced"]')?.hidden).toBe(true);
  });

  it("puts a summary line before each seller table", () => {
    const doc = PAGE();

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc);

    const lines = [...doc.querySelectorAll("[data-openrift-wizard-seller]")].map(
      (line) => line.textContent,
    );
    expect(lines).toHaveLength(2);
    expect(lines).toEqual([
      "Whole order stays on Cardmarket: CardTrader would not come out cheaper.",
      "Whole order stays on Cardmarket: CardTrader would not come out cheaper.",
    ]);
    expect(
      doc
        .querySelector(".detailed-result-card table")
        ?.previousElementSibling?.matches("[data-openrift-wizard-seller]"),
    ).toBe(true);
  });

  it("renders nothing without a snapshot or off a wizard page", () => {
    const doc = PAGE();
    expect(renderWizardPanel(doc, extractWizardRows(doc), undefined, doc)).toBeUndefined();
    expect(doc.querySelector("[data-openrift-wizard]")).toBeNull();

    const other = new DOMParser().parseFromString(
      "<html><body><p>x</p></body></html>",
      "text/html",
    );
    expect(renderWizardPanel(other, [], SNAPSHOT, other)).toBeUndefined();
  });

  it("leaves the Zero fee out when the toggle is off and repaints on the next call", () => {
    const doc = PAGE();

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc, false);

    expect(doc.querySelector('[data-role="allCardtrader"]')?.textContent).toMatch(/1[.,]90$/u);
    // Without the fee everything is cheaper on CardTrader, and the lists follow.
    const areas = [...doc.querySelectorAll<HTMLTextAreaElement>("[data-openrift-wizard] textarea")];
    expect(areas.map((area) => area.value)).toEqual(["", "1x Heart of Dark Ice\n2x Undertitan"]);
    expect([...doc.querySelectorAll("[data-openrift-wizard-seller]")][0]?.textContent).toMatch(
      /^Whole order goes to CardTrader/u,
    );
    expect(
      doc.querySelector<HTMLInputElement>("[data-openrift-wizard-zero-shipping]")?.checked,
    ).toBe(false);
    expect(zeroShippingToggle(doc.querySelector("[data-openrift-wizard-zero-shipping]"))).toBe(
      false,
    );
    expect(zeroShippingToggle(doc.body)).toBeUndefined();

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc, true);
    expect(doc.querySelector('[data-role="allCardtrader"]')?.textContent).toMatch(/20[.,]80$/u);
  });

  it("disables the pick button when nothing moves", () => {
    // Shipping 0,10: the 0,30 the card saves keeps the seller.
    const doc = pageWith([card(wizardRow(2, 866_779, "Heart of Dark Ice", 1, "1,20 €"), "0,10 €")]);

    renderWizardPanel(doc, extractWizardRows(doc), SNAPSHOT, doc);

    const button = doc.querySelector<HTMLButtonElement>("[data-openrift-wizard-pick]");
    expect(button?.disabled).toBe(true);
    expect(isPickAllClick(button)).toBe(true);
    expect(isPickAllClick(doc.body)).toBe(false);
  });
});
