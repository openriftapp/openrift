import { overlayCell } from "./cardmarket-cell";
import type { PriceVerdict } from "./cardmarket-price";
import { priceVerdict } from "./cardmarket-price";
import type { CardmarketArticleRow } from "./cardmarket-rows";
import { extractCardmarketRows } from "./cardmarket-rows";
import type { OverlayCounts, OverlaySnapshot } from "./overlay-snapshot";
import { countsForProduct } from "./overlay-snapshot";

const PILL_ATTRIBUTE = "data-openrift-overlay";
const PRICE_ATTRIBUTE = "data-openrift-overlay-price";
const PRICE_CONTAINER_SELECTOR = ".price-container";
const OFFER_COLUMN_SELECTOR = ".col-offer";
const COLOURED_ATTRIBUTE = "data-openrift-overlay-verdict";

const VERDICT_COLOUR: Record<"light" | "dark", Record<PriceVerdict, string>> = {
  light: { below: "#15803d", near: "#a16207", above: "#b91c1c" },
  dark: { below: "#4ade80", near: "#fbbf24", above: "#f87171" },
};

const PILL_STYLE = [
  "order:1",
  "display:inline-flex",
  "gap:4px",
  "align-items:center",
  "padding:0 6px",
  "border-radius:999px",
  "font-size:11px",
  "font-weight:600",
  "line-height:18px",
  "white-space:nowrap",
  "vertical-align:middle",
].join(";");

const PRICE_STYLE = [
  "display:block",
  "flex-basis:100%",
  "width:100%",
  "text-align:right",
  "font-size:11px",
  "line-height:1.3",
  "opacity:0.75",
  "white-space:nowrap",
].join(";");

const CELL_PRICE_STYLE = ["order:2", "font-size:11px", "opacity:0.75", "white-space:nowrap"].join(
  ";",
);

const NEUTRAL = "background:#e5e7eb;color:#374151";
const WANTED = "background:#166534;color:#f0fdf4";

export function pillText(counts: OverlayCounts): string {
  return `own ${counts.owned} · want ${counts.wanted}`;
}

function verdictColour(doc: Document, verdict: PriceVerdict): string {
  const dark = doc.documentElement.dataset.bsTheme === "dark";
  return VERDICT_COLOUR[dark ? "dark" : "light"][verdict];
}

function paintSellerPrice(row: CardmarketArticleRow, colour?: string): void {
  for (const element of row.priceElements) {
    if (colour === undefined) {
      if (element.hasAttribute(COLOURED_ATTRIBUTE)) {
        element.style.removeProperty("color");
        element.removeAttribute(COLOURED_ATTRIBUTE);
      }
      continue;
    }
    element.setAttribute(COLOURED_ATTRIBUTE, "");
    // Cardmarket's own rule for this class wins a plain inline colour.
    element.style.setProperty("color", colour, "important");
  }
}

export function formatEuro(cents: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function referencePriceText(cardtraderCents: number, locale?: string): string {
  return `CT ${formatEuro(cardtraderCents, locale)}`;
}

function upsert(
  row: CardmarketArticleRow,
  attribute: string,
  style: string,
  text: string,
  doc: Document,
): HTMLElement {
  const existing = row.element.querySelector<HTMLElement>(`[${attribute}]`);
  const element = existing ?? doc.createElement("span");
  element.setAttribute(attribute, "");
  element.setAttribute("style", style);
  // Assigning equal text still replaces the node, which the page observer would see as a change.
  if (element.textContent !== text) {
    element.textContent = text;
  }
  return element;
}

function annotateCounts(row: CardmarketArticleRow, counts: OverlayCounts, doc: Document): boolean {
  if (counts.owned === 0 && counts.wanted === 0) {
    row.element.querySelector(`[${PILL_ATTRIBUTE}]`)?.remove();
    return false;
  }
  const style = `${PILL_STYLE};${counts.wanted > 0 ? WANTED : NEUTRAL}`;
  const pill = upsert(row, PILL_ATTRIBUTE, style, pillText(counts), doc);
  if (!pill.isConnected) {
    overlayCell(row.element, doc).append(pill);
  }
  return true;
}

function annotatePrice(row: CardmarketArticleRow, counts: OverlayCounts, doc: Document): void {
  if (counts.cardtraderCents === null) {
    row.element.querySelector(`[${PRICE_ATTRIBUTE}]`)?.remove();
    paintSellerPrice(row);
    return;
  }
  const verdict =
    row.priceCents === undefined ? undefined : priceVerdict(row.priceCents, counts.cardtraderCents);
  paintSellerPrice(row, verdict === undefined ? undefined : verdictColour(doc, verdict));

  const text = referencePriceText(counts.cardtraderCents);
  const inCell = row.element instanceof HTMLTableRowElement;
  const price = upsert(row, PRICE_ATTRIBUTE, inCell ? CELL_PRICE_STYLE : PRICE_STYLE, text, doc);
  if (price.isConnected) {
    return;
  }
  if (inCell) {
    // The extra column narrows the table in a half-width card; "0,15 €" must not break.
    for (const element of row.priceElements) {
      element.style.setProperty("white-space", "nowrap");
    }
    overlayCell(row.element, doc).append(price);
    return;
  }
  const container = row.element.querySelector<HTMLElement>(PRICE_CONTAINER_SELECTOR);
  if (container !== null) {
    // Cardmarket lays the container out as a flex row; wrapping puts the line beneath.
    container.style.setProperty("flex-wrap", "wrap");
    container.append(price);
    return;
  }
  row.element.querySelector(OFFER_COLUMN_SELECTOR)?.append(price);
}

/** Rows with no resolvable product carry nothing at all: a wrong zero reads as "I own none". */
export function annotate(root: ParentNode, snapshot: OverlaySnapshot, doc: Document): number {
  let annotated = 0;

  for (const row of extractCardmarketRows(root)) {
    if (row.idProduct === undefined) {
      continue;
    }
    const counts = countsForProduct(snapshot, row.idProduct, row.finish);
    if (annotateCounts(row, counts, doc)) {
      annotated += 1;
    }
    annotatePrice(row, counts, doc);
  }

  return annotated;
}
