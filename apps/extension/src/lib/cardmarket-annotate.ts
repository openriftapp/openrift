import { overlayCell } from "./cardmarket-cell";
import type { PriceVerdict } from "./cardmarket-price";
import { parsePriceCents, priceVerdict } from "./cardmarket-price";
import type { CardmarketArticleRow } from "./cardmarket-rows";
import { extractArticleRows } from "./cardmarket-rows";
import type { OverlayCounts, OverlayMarketplace, OverlaySnapshot } from "./overlay-snapshot";
import { countsForProduct } from "./overlay-snapshot";

const PILL_ATTRIBUTE = "data-openrift-overlay";
const PRICE_ATTRIBUTE = "data-openrift-overlay-price";
const PRICE_CONTAINER_SELECTOR = ".price-container";
const OFFER_COLUMN_SELECTOR = ".col-offer";
const SELLER_PRICE_SELECTOR = ".color-primary";
const COLOURED_ATTRIBUTE = "data-openrift-overlay-verdict";

// Cardmarket sells in euro, so a dollar reference cannot be compared to the ask.
const COMPARABLE: ReadonlySet<OverlayMarketplace> = new Set(["cardmarket", "cardtrader"]);

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

const NEUTRAL = "background:#e5e7eb;color:#374151";
const WANTED = "background:#166534;color:#f0fdf4";

const MARKETPLACE_LABEL: Record<OverlayMarketplace, string> = {
  cardmarket: "CM",
  tcgplayer: "TCG",
  cardtrader: "CT",
};

const MARKETPLACE_CURRENCY: Record<OverlayMarketplace, string> = {
  cardmarket: "EUR",
  tcgplayer: "USD",
  cardtrader: "EUR",
};

export function pillText(counts: OverlayCounts): string {
  return `own ${counts.owned} · want ${counts.wanted}`;
}

function verdictColour(doc: Document, verdict: PriceVerdict): string {
  const dark = doc.documentElement.dataset.bsTheme === "dark";
  return VERDICT_COLOUR[dark ? "dark" : "light"][verdict];
}

function sellerPriceCents(row: CardmarketArticleRow): number | undefined {
  for (const element of row.element.querySelectorAll(SELLER_PRICE_SELECTOR)) {
    const cents = parsePriceCents(element.textContent ?? "");
    if (cents !== undefined) {
      return cents;
    }
  }
  return undefined;
}

function paintSellerPrice(row: CardmarketArticleRow, colour?: string): void {
  for (const element of row.element.querySelectorAll<HTMLElement>(SELLER_PRICE_SELECTOR)) {
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

export function referencePriceText(
  marketplace: OverlayMarketplace,
  priceCents: number,
  locale?: string,
): string {
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: MARKETPLACE_CURRENCY[marketplace],
  }).format(priceCents / 100);
  return `${MARKETPLACE_LABEL[marketplace]} ${amount}`;
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
  element.textContent = text;
  return element;
}

function annotateCounts(row: CardmarketArticleRow, counts: OverlayCounts, doc: Document): boolean {
  if (row.productLink === undefined || (counts.owned === 0 && counts.wanted === 0)) {
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

function annotatePrice(
  row: CardmarketArticleRow,
  counts: OverlayCounts,
  marketplace: OverlayMarketplace,
  doc: Document,
): void {
  if (counts.priceCents === null) {
    row.element.querySelector(`[${PRICE_ATTRIBUTE}]`)?.remove();
    paintSellerPrice(row);
    return;
  }
  const seller = COMPARABLE.has(marketplace) ? sellerPriceCents(row) : undefined;
  const verdict = seller === undefined ? undefined : priceVerdict(seller, counts.priceCents);
  paintSellerPrice(row, verdict === undefined ? undefined : verdictColour(doc, verdict));

  const text = referencePriceText(marketplace, counts.priceCents);
  const price = upsert(row, PRICE_ATTRIBUTE, PRICE_STYLE, text, doc);
  if (price.isConnected) {
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

  for (const row of extractArticleRows(root)) {
    if (row.idProduct === undefined) {
      continue;
    }
    const counts = countsForProduct(snapshot, row.idProduct, row.finish);
    if (annotateCounts(row, counts, doc)) {
      annotated += 1;
    }
    annotatePrice(row, counts, snapshot.marketplace, doc);
  }

  return annotated;
}
