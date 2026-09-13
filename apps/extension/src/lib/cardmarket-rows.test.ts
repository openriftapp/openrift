import { describe, expect, it } from "vitest";

import { extractArticleRows, extractCardmarketRows, extractWizardRows } from "./cardmarket-rows";

// Trimmed from a saved seller offers page: the SVG rarity icon, the sprite URLs
// and the cart form are dropped, every attribute that matters is verbatim.
const FOIL_ROW = `
<div id="stockRow2097794251" class="row g-0 article-row">
  <div class="col-thumbnail col-icon">
    <span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/OGN/847321/847321.jpg&quot; alt=&quot;Volibear, Imposing (V.1 - Rare)&quot;&gt;" data-bs-toggle="tooltip" class="thumbnail-icon icon is-24x24 is-riftbound"><span class="fonticon-camera"></span></span>
  </div>
  <div class="col-sellerProductInfo col"><div class="row g-0">
    <div class="col-seller col-12 col-lg-auto"><a href="/de/Riftbound/Products/Singles/Origins/Volibear-Imposing-V1-Rare?language=1&amp;minCondition=2&amp;isFoil=Y">Volibear, Imposing (V.1 - Rare)</a></div>
    <div class="col-product col-12 col-lg"><div class="row g-0"><div class="product-attributes col">
      <a href="/de/Riftbound/Expansions/Origins" class="expansion-symbol is-riftbound is-text d-flex me-1" data-bs-original-title="Origins"><span>OGN</span></a>
      <a href="https://help.cardmarket.com/de/CardCondition" class="article-condition condition-nm me-1" data-bs-original-title="Near Mint"><span class="badge ">NM</span></a>
      <span class="icon me-2" aria-label="Englisch" data-bs-original-title="Englisch"></span>
      <span class="icon st_SpecialIcon mr-1" aria-label="Foil" data-original-title="Foil"></span>
    </div></div></div>
  </div></div>
  <div class="col-offer col-auto"><span class="item-count small text-end">1</span></div>
</div>`;

const PLAIN_ROW = `
<div id="stockRow2097801528" class="row g-0 article-row">
  <div class="col-thumbnail col-icon">
    <span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/OGN/847358/847358.jpg&quot; alt=&quot;Maddened Marauder&quot;&gt;" data-bs-toggle="tooltip" class="thumbnail-icon icon is-24x24 is-riftbound"><span class="fonticon-camera"></span></span>
  </div>
  <div class="col-sellerProductInfo col"><div class="row g-0">
    <div class="col-seller col-12 col-lg-auto"><a href="/de/Riftbound/Products/Singles/Origins/Maddened-Marauder?language=1&amp;minCondition=2&amp;isFoil=Y">Maddened Marauder</a></div>
    <div class="col-product col-12 col-lg"><div class="row g-0"><div class="product-attributes col">
      <a href="/de/Riftbound/Expansions/Origins" class="expansion-symbol d-flex me-1" data-bs-original-title="Origins"><span>OGN</span></a>
      <span class="icon me-2" aria-label="Englisch" data-bs-original-title="Englisch"></span>
    </div></div></div>
  </div></div>
</div>`;

// Trimmed from a saved shopping wizard result: sprite styles, tooltips and the
// mobile copy of each row are dropped, the cells and their order are verbatim.
const WIZARD_CARD = `
<div class="card detailed-result-card"><div class="card-body">
  <dl class="row"><dt>Total</dt><dd>2,75 €</dd></dl><hr>
  <table class="table table-sm"><thead><tr><th class="text-start"></th><th class="text-start"></th><th class="text-start">Qty</th><th class="text-start">Card name</th><th class="text-start"></th><th class="text-start"></th><th class="text-start"></th><th class="text-start">Extra</th><th>Price</th></tr></thead><tbody>
    <tr><td class="text-start"><input type="checkbox" name="checkboxArticle[2075594192]" checked="checked" data-id-article="2075594192"></td><td class="text-start"><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/SFD/866920/866920.jpg&quot; alt=&quot;Undertitan&quot;&gt;" class="thumbnail-icon icon is-24x24 is-riftbound"></span></td><td class="text-start">2</td><td class="text-start text-truncate card-name">Undertitan</td><td class="text-start"><span class="expansion-symbol is-text"><span>SFD</span></span></td><td class="text-start"><span class="icon" aria-label="English" data-bs-original-title="English"></span></td><td class="text-start"><a class="article-condition condition-nm"><span class="badge ">NM</span></a></td><td class="text-start"><span class="extras "><span class="icon is-24x24"><span class="icon" aria-label="Foil" data-bs-original-title="Foil"></span></span></span></td><td class="text-end">0,35 €</td></tr>
    <tr><td class="text-start"><input type="checkbox" name="checkboxArticle[2154498896]" checked="checked" data-id-article="2154498896"></td><td class="text-start"><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1655/SFD/866779/866779.jpg&quot; alt=&quot;Heart of Dark Ice&quot;&gt;" class="thumbnail-icon icon is-24x24 is-riftbound"></span></td><td class="text-start">1</td><td class="text-start text-truncate card-name">Heart of Dark Ice</td><td class="text-start"><span class="expansion-symbol is-text"><span>SFD</span></span></td><td class="text-start"><span class="icon" aria-label="Deutsch" data-bs-original-title="Deutsch"></span></td><td class="text-start"><a class="article-condition condition-nm"><span class="badge ">NM</span></a></td><td class="text-start"><span class="extras "></span></td><td class="text-end">1,20 €</td></tr>
  </tbody></table>
  <div class="d-md-none"><div name="articleRowMobile[2075594192]" class="row"><input type="checkbox" name="checkboxArticle[2075594192]" data-id-article="2075594192"><span>Undertitan</span></div></div>
</div></div>`;

function documentFrom(bodyHtml: string): Document {
  return new DOMParser().parseFromString(`<html><body>${bodyHtml}</body></html>`, "text/html");
}

describe("extractArticleRows", () => {
  it("reads the product id out of the thumbnail image and marks the foil", () => {
    const rows = extractArticleRows(documentFrom(FOIL_ROW + PLAIN_ROW));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.idProduct).toBe(847_321);
    expect(rows[0]?.finish).toBe("foil");
    expect(rows[1]?.idProduct).toBe(847_358);
    expect(rows[1]?.finish).toBe("normal");
  });

  it("picks the product link and name out of the seller column", () => {
    const row = extractArticleRows(documentFrom(FOIL_ROW))[0];

    expect(row?.productLink?.textContent?.trim()).toBe("Volibear, Imposing (V.1 - Rare)");
    expect(row?.productLink?.getAttribute("href")).toContain("/Products/Singles/Origins/");
    expect(row?.productName).toBe("Volibear, Imposing (V.1 - Rare)");
  });

  it("reads the language off the flag label and skips the foil icon", () => {
    const row = extractArticleRows(documentFrom(FOIL_ROW))[0];

    expect(row?.idLanguage).toBe(1);
    expect(row?.languageLabel).toBe("Englisch");
  });

  it("leaves the language open when no icon label is one", () => {
    const doc = documentFrom(`
      <div id="stockRow1">
        <div class="col-seller"><a href="/de/Riftbound/Products/Singles/Origins/Card">Card</a></div>
        <span class="icon st_SpecialIcon" aria-label="Foil"></span>
      </div>`);

    const row = extractArticleRows(doc)[0];

    expect(row?.idLanguage).toBeUndefined();
    expect(row?.languageLabel).toBeUndefined();
  });

  it("reads a plain img tag when the thumbnail is not a tooltip", () => {
    const doc = documentFrom(`
      <div id="stockRow1">
        <img src="https://product-images.s3.cardmarket.com/1655/OGN/847321/847321.jpg" alt="" />
        <div class="col-seller"><a href="/de/Riftbound/Products/Singles/Origins/Card">Card</a></div>
      </div>`);

    expect(extractArticleRows(doc)[0]?.idProduct).toBe(847_321);
  });

  it("returns the row with no id when the thumbnail is missing", () => {
    const doc = documentFrom(`
      <div id="stockRow1">
        <div class="col-seller"><a href="/de/Riftbound/Products/Singles/Origins/Card">Card</a></div>
      </div>`);

    const rows = extractArticleRows(doc);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.idProduct).toBeUndefined();
  });

  it("finds nothing on a page without article rows", () => {
    expect(extractArticleRows(documentFrom("<p>Keine Angebote</p>"))).toEqual([]);
  });

  it("reads the asking price off the offer", () => {
    const doc = documentFrom(`
      <div id="stockRow1">
        <img src="https://product-images.s3.cardmarket.com/1655/OGN/847321/847321.jpg" alt="" />
        <div class="price-container"><span class="color-primary">1.234,56 €</span></div>
      </div>`);

    const row = extractArticleRows(doc)[0];

    expect(row?.priceCents).toBe(123_456);
    expect(row?.priceElements).toHaveLength(1);
    expect(row?.quantity).toBe(1);
  });
});

describe("extractWizardRows", () => {
  it("reads every desktop row of a seller table and skips the mobile copies", () => {
    const rows = extractWizardRows(documentFrom(WIZARD_CARD));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.idProduct)).toEqual([866_920, 866_779]);
    expect(rows.map((row) => row.productName)).toEqual(["Undertitan", "Heart of Dark Ice"]);
    expect(rows.every((row) => row.element instanceof HTMLTableRowElement)).toBe(true);
  });

  it("reads quantity, price, finish and language per row", () => {
    const [foil, plain] = extractWizardRows(documentFrom(WIZARD_CARD));

    expect(foil?.quantity).toBe(2);
    expect(foil?.priceCents).toBe(35);
    expect(foil?.finish).toBe("foil");
    expect(foil?.idLanguage).toBe(1);
    expect(plain?.quantity).toBe(1);
    expect(plain?.priceCents).toBe(120);
    expect(plain?.finish).toBe("normal");
    expect(plain?.idLanguage).toBe(3);
    expect(plain?.languageLabel).toBe("Deutsch");
  });

  it("paints the price cell, not the whole row", () => {
    const row = extractWizardRows(documentFrom(WIZARD_CARD))[0];

    expect(row?.priceElements.map((element) => element.textContent)).toEqual(["0,35 €"]);
  });

  it("has no product link to offer", () => {
    expect(extractWizardRows(documentFrom(WIZARD_CARD))[0]?.productLink).toBeUndefined();
  });
});

describe("extractCardmarketRows", () => {
  it("prefers offer rows and falls back to wizard rows", () => {
    expect(extractCardmarketRows(documentFrom(PLAIN_ROW + WIZARD_CARD))).toHaveLength(1);
    expect(extractCardmarketRows(documentFrom(WIZARD_CARD))).toHaveLength(2);
    expect(extractCardmarketRows(documentFrom("<p>Nothing</p>"))).toEqual([]);
  });
});
