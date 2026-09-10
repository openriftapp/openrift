import { describe, expect, it } from "vitest";

import { overlayCell, overlayHeader } from "./cardmarket-cell";

function documentFrom(bodyHtml: string): Document {
  return new DOMParser().parseFromString(`<html><body>${bodyHtml}</body></html>`, "text/html");
}

function rowOf(doc: Document, selector: string): HTMLElement {
  const row = doc.querySelector<HTMLElement>(selector);
  if (row === null) {
    throw new Error(`fixture missing: ${selector}`);
  }
  return row;
}

// Trimmed from a live offers page: the header row and one article row share
// the same column sequence, with the offer column last.
const TABLE = `
  <div class="table article-table">
    <div class="table-header d-none d-lg-flex"><div class="row g-0 flex-nowrap">
      <div class="col-thumbnail col-icon"></div>
      <div class="col-sellerProductInfo col"><div class="row g-0 h-100">
        <div class="col-seller col-12 col-lg-auto"><div>Name</div></div>
        <div class="col-product col-12 col-lg"><div>Info</div></div>
      </div></div>
      <div class="col-offer col-auto">Angebot</div>
    </div></div>
    <div class="table-body">
      <div id="stockRow1" class="row g-0 article-row">
        <div class="col-thumbnail col-icon"></div>
        <div class="col-sellerProductInfo col"><div class="row g-0">
          <div class="col-seller col-12 col-lg-auto"><a href="/Products/x">Card</a></div>
          <div class="col-product col-12 col-lg"></div>
        </div></div>
        <div class="col-offer col-auto"></div>
      </div>
    </div>
  </div>`;

describe("overlayCell", () => {
  it("becomes the row's last column, after the offer column, and is reused", () => {
    const doc = documentFrom(TABLE);
    const row = rowOf(doc, "#stockRow1");

    const cell = overlayCell(row, doc);

    expect(row.lastElementChild).toBe(cell);
    expect(cell.previousElementSibling?.matches(".col-offer")).toBe(true);
    expect(cell.classList.contains("col-auto")).toBe(true);
    expect(overlayCell(row, doc)).toBe(cell);
  });
});

describe("overlayHeader", () => {
  it("labels the header's column row once, in the same last-column position", () => {
    const doc = documentFrom(TABLE);

    expect(overlayHeader(doc, doc)).toBe(true);
    expect(overlayHeader(doc, doc)).toBe(true);

    const cells = doc.querySelectorAll(".table-header [data-openrift-cell]");
    expect(cells).toHaveLength(1);
    expect(cells[0]?.querySelector("[data-openrift-header]")?.textContent).toBe("OpenRift");
    expect(cells[0]?.parentElement?.matches(".table-header > .row")).toBe(true);
    expect(cells[0]?.previousElementSibling?.matches(".col-offer")).toBe(true);
  });

  it("opens the column help from the info button and closes it on a click elsewhere", () => {
    const doc = documentFrom(TABLE);
    overlayHeader(doc, doc);
    const toggle = doc.querySelector<HTMLButtonElement>("[data-openrift-help-toggle]");
    const help = doc.querySelector<HTMLElement>("[data-openrift-help]");

    expect(help?.hidden).toBe(true);
    toggle?.click();
    expect(help?.hidden).toBe(false);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(help?.textContent).toContain("own · want");

    rowOf(doc, "#stockRow1").click();
    expect(help?.hidden).toBe(true);
  });

  it("does nothing on a page without a table header", () => {
    const doc = documentFrom('<div id="stockRow1"></div>');

    expect(overlayHeader(doc, doc)).toBe(false);
    expect(doc.querySelector("[data-openrift-cell]")).toBeNull();
  });
});
