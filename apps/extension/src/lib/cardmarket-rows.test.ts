import { describe, expect, it } from "vitest";

import { extractArticleRows } from "./cardmarket-rows";

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

  it("picks the product link out of the seller column", () => {
    const link = extractArticleRows(documentFrom(FOIL_ROW))[0]?.productLink;

    expect(link?.textContent?.trim()).toBe("Volibear, Imposing (V.1 - Rare)");
    expect(link?.getAttribute("href")).toContain("/Products/Singles/Origins/");
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
});
