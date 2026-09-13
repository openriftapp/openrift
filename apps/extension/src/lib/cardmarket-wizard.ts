import { formatEuro } from "./cardmarket-annotate";
import { parsePriceCents } from "./cardmarket-price";
import type { CardmarketArticleRow } from "./cardmarket-rows";
import type { OverlaySnapshot } from "./overlay-snapshot";
import { countsForProduct } from "./overlay-snapshot";
import type { SellerShipping, WizardLine, WizardSplit } from "./wizard-split";
import {
  cardtraderZeroShippingCents,
  lineCount,
  needsAttributeNote,
  sellerSummaryText,
  splitWizardLines,
  totalsText,
  wantsText,
} from "./wizard-split";

/** The basket key for wizard picks; the wizard spans sellers, so the list is named after it. */
export const WIZARD_SELLER = "Shopping Wizard";

const SUMMARY_SELECTOR = "#ShoppingWizardResult";
const CARD_SELECTOR = ".detailed-result-card";
const CARD_TABLE_SELECTOR = "table";
// The shipping row of a seller card is the dt carrying the shipping icon, in any interface language.
const SHIPPING_TERM_SELECTOR = "dt:has(.fonticon-shipping-methods)";

const PANEL_ATTRIBUTE = "data-openrift-wizard";
const SELLER_ATTRIBUTE = "data-openrift-wizard-seller";
const PART_ATTRIBUTE = "data-openrift-wizard-part";
const COPY_ATTRIBUTE = "data-openrift-wizard-copy";
export const PICK_ALL_ATTRIBUTE = "data-openrift-wizard-pick";
export const ZERO_SHIPPING_ATTRIBUTE = "data-openrift-wizard-zero-shipping";
export const ZERO_SHIPPING_STORAGE_KEY = "wizardCountZeroShipping";

const COPIED_RESET_MS = 1500;

const PANEL_STYLE = "margin-top:16px;padding-top:12px;border-top:1px solid rgba(128,128,128,0.35)";
const TITLE_STYLE = "margin:0 0 8px;font-size:14px;font-weight:600";
const LINE_STYLE = "margin:0 0 2px;font-size:13px";
const NOTE_STYLE = "margin:6px 0 0;font-size:12px;opacity:0.75";
const COLUMNS_STYLE = "display:flex;flex-wrap:wrap;gap:16px;margin-top:12px";
const COLUMN_STYLE = "flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:6px";
const LABEL_STYLE = "margin:0;font-size:13px;font-weight:600";
const ACTIONS_STYLE = "display:flex;gap:8px;flex-wrap:wrap";
const SELLER_LINE_STYLE = "margin:8px 0 0;font-size:12px;text-align:left";
const TOGGLE_STYLE = "display:flex;align-items:center;gap:6px;margin:8px 0 0;font-size:13px";
const COLUMN_TOTAL_STYLE = "margin:0 0 6px;font-size:13px;font-weight:600";
const BELOW_STYLE = "margin-top:12px;padding-top:10px;border-top:1px solid rgba(128,128,128,0.35)";

function setText(element: Element, text: string): void {
  // Equal text still replaces the node, which the page observer would take for a change.
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

function lineOf(row: CardmarketArticleRow, snapshot: OverlaySnapshot): WizardLine | undefined {
  if (row.idProduct === undefined || row.priceCents === undefined) {
    return undefined;
  }
  return {
    seller: row.element.closest<HTMLElement>(CARD_SELECTOR)?.id ?? "",
    idProduct: row.idProduct,
    finish: row.finish,
    idLanguage: row.idLanguage ?? null,
    languageLabel: row.languageLabel ?? null,
    productName: row.productName ?? `Cardmarket product ${row.idProduct}`,
    quantity: row.quantity,
    cardmarketCents: row.priceCents,
    cardtraderCents: countsForProduct(snapshot, row.idProduct, row.finish).cardtraderCents,
  };
}

/** Every row the wizard priced, with the snapshot's CardTrader price beside it. */
export function wizardLines(
  rows: readonly CardmarketArticleRow[],
  snapshot: OverlaySnapshot,
): WizardLine[] {
  return rows.flatMap((row) => {
    const line = lineOf(row, snapshot);
    return line === undefined ? [] : [line];
  });
}

/** Each seller card's shipping estimate, keyed like the lines' `seller`. */
export function sellerShipping(root: ParentNode): SellerShipping {
  const shipping = new Map<string, number | undefined>();
  for (const card of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    const term = card.querySelector(SHIPPING_TERM_SELECTOR);
    const value = term?.nextElementSibling;
    shipping.set(
      card.id,
      value === null || value === undefined ? undefined : parsePriceCents(value.textContent ?? ""),
    );
  }
  return shipping;
}

function paragraph(doc: Document, style: string, attribute?: string): HTMLParagraphElement {
  const element = doc.createElement("p");
  element.setAttribute("style", style);
  if (attribute !== undefined) {
    element.setAttribute(attribute, "");
  }
  return element;
}

function button(doc: Document, label: string, attribute: string, value: string): HTMLButtonElement {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = "btn btn-sm btn-outline-primary";
  element.setAttribute(attribute, value);
  element.textContent = label;
  return element;
}

/** Firefox lets a content script write the clipboard on a click; failing that, the text is left selected. */
async function copyText(area: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(area.value);
    return true;
  } catch {
    area.focus();
    area.select();
    return false;
  }
}

function column(
  document: Document,
  part: "cardmarket" | "cardtrader",
  label: string,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute(PART_ATTRIBUTE, part);
  wrapper.setAttribute("style", COLUMN_STYLE);

  const total = paragraph(document, COLUMN_TOTAL_STYLE);
  total.dataset.role = part === "cardmarket" ? "allCardmarket" : "allCardtrader";

  const title = paragraph(document, LABEL_STYLE);
  title.dataset.role = "label";
  title.textContent = label;

  const area = document.createElement("textarea");
  area.className = "form-control";
  area.readOnly = true;
  area.rows = 6;
  area.setAttribute("style", "font-family:monospace;font-size:12px");

  const actions = document.createElement("div");
  actions.setAttribute("style", ACTIONS_STYLE);
  const copy = button(document, "Copy list", COPY_ATTRIBUTE, part);
  copy.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void (async () => {
      copy.textContent = (await copyText(area)) ? "Copied" : "Selected, press Ctrl+C";
      setTimeout(() => {
        copy.textContent = "Copy list";
      }, COPIED_RESET_MS);
    })();
  });
  actions.append(copy);
  if (part === "cardtrader") {
    actions.append(button(document, "Pick for OpenRift", PICK_ALL_ATTRIBUTE, ""));
  }

  const note = paragraph(document, NOTE_STYLE);
  note.dataset.role = "note";
  note.hidden = true;

  wrapper.append(total, title, area, actions, note);
  return wrapper;
}

function buildPanel(document: Document): HTMLDivElement {
  const panel = document.createElement("div");
  panel.setAttribute(PANEL_ATTRIBUTE, "");
  panel.setAttribute("style", PANEL_STYLE);

  const title = paragraph(document, TITLE_STYLE);
  title.textContent = "OpenRift · against CardTrader Zero";

  const below = document.createElement("div");
  below.setAttribute("style", BELOW_STYLE);
  const best = paragraph(document, LINE_STYLE);
  best.dataset.role = "best";
  best.style.setProperty("font-weight", "600");
  const unpriced = paragraph(document, NOTE_STYLE);
  unpriced.dataset.role = "unpriced";
  unpriced.hidden = true;

  const toggle = document.createElement("label");
  toggle.setAttribute("style", TOGGLE_STYLE);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "form-check-input";
  checkbox.setAttribute("style", "margin:0");
  checkbox.setAttribute(ZERO_SHIPPING_ATTRIBUTE, "");
  toggle.append(
    checkbox,
    document.createTextNode(
      `Count CardTrader Zero shipping (${formatEuro(cardtraderZeroShippingCents(1))} up to 494 cards to Germany). Untick for an order that ships anyway.`,
    ),
  );

  const columns = document.createElement("div");
  columns.setAttribute("style", COLUMNS_STYLE);
  columns.append(
    column(document, "cardmarket", "Buy on Cardmarket"),
    column(document, "cardtrader", "Buy on CardTrader"),
  );

  below.append(best, unpriced, toggle);
  panel.append(title, columns, below);
  return panel;
}

// A wants list carries neither finish nor language, so a moved foil or non-English row needs a word.
const ATTRIBUTE_NOTE = {
  cardmarket:
    "Some of these are foil or not English. Set foil and language on the new wants list again.",
  cardtrader:
    "Some of these are foil or not English. The copied list loses both; Pick for OpenRift keeps them.",
} as const;

function partLabel(part: "cardmarket" | "cardtrader", lines: readonly WizardLine[]): string {
  const where = part === "cardmarket" ? "Cardmarket" : "CardTrader";
  const count = lineCount(lines);
  return `Buy on ${where} (${count} card${count === 1 ? "" : "s"})`;
}

function paintColumn(panel: HTMLElement, part: "cardmarket" | "cardtrader", lines: WizardLine[]) {
  const wrapper = panel.querySelector<HTMLElement>(`[${PART_ATTRIBUTE}="${part}"]`);
  if (wrapper === null) {
    return;
  }
  const label = wrapper.querySelector('[data-role="label"]');
  const area = wrapper.querySelector("textarea");
  const note = wrapper.querySelector<HTMLElement>('[data-role="note"]');
  const pickAll = wrapper.querySelector<HTMLButtonElement>(`[${PICK_ALL_ATTRIBUTE}]`);
  if (label !== null) {
    setText(label, partLabel(part, lines));
  }
  if (area !== null && area.value !== wantsText(lines)) {
    area.value = wantsText(lines);
  }
  if (note !== null) {
    const show = needsAttributeNote(lines);
    note.hidden = !show;
    setText(note, show ? ATTRIBUTE_NOTE[part] : "");
  }
  if (pickAll !== null) {
    pickAll.disabled = lines.length === 0;
  }
}

function paintPanel(panel: HTMLElement, split: WizardSplit, countZeroShipping: boolean): void {
  const checkbox = panel.querySelector<HTMLInputElement>(`[${ZERO_SHIPPING_ATTRIBUTE}]`);
  if (checkbox !== null) {
    checkbox.checked = countZeroShipping;
  }
  const totals = totalsText(split);
  for (const [role, text] of Object.entries(totals)) {
    const line = panel.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (line === null) {
      continue;
    }
    line.hidden = text === undefined;
    setText(line, text ?? "");
  }
  paintColumn(panel, "cardmarket", split.cardmarket);
  paintColumn(panel, "cardtrader", split.cardtrader);
}

function paintSellerCards(root: ParentNode, split: WizardSplit, document: Document): void {
  for (const card of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    const table = card.querySelector<HTMLElement>(CARD_TABLE_SELECTOR);
    const decision = split.sellers.find((candidate) => candidate.seller === card.id);
    if (table === null || decision === undefined) {
      continue;
    }
    const text = sellerSummaryText(decision, split.winner);
    let line = card.querySelector<HTMLElement>(`[${SELLER_ATTRIBUTE}]`);
    if (line === null) {
      line = paragraph(document, SELLER_LINE_STYLE, SELLER_ATTRIBUTE);
      table.before(line);
    }
    setText(line, text);
  }
}

/** Builds the panel once and repaints it in place; nothing without a snapshot to compare against. */
export function renderWizardPanel(
  root: ParentNode,
  rows: readonly CardmarketArticleRow[],
  snapshot: OverlaySnapshot | undefined,
  document: Document,
  countZeroShipping = true,
): WizardSplit | undefined {
  const summary = root.querySelector<HTMLElement>(SUMMARY_SELECTOR);
  if (summary === null || snapshot === undefined) {
    return undefined;
  }
  const split = splitWizardLines(
    wizardLines(rows, snapshot),
    sellerShipping(root),
    countZeroShipping,
  );
  let panel = summary.querySelector<HTMLElement>(`[${PANEL_ATTRIBUTE}]`);
  if (panel === null) {
    panel = buildPanel(document);
    summary.append(panel);
  }
  paintPanel(panel, split, countZeroShipping);
  paintSellerCards(root, split, document);
  return split;
}

/** The new state of the Zero shipping toggle when the change came from it, else undefined. */
export function zeroShippingToggle(target: EventTarget | null): boolean | undefined {
  return target instanceof HTMLInputElement && target.hasAttribute(ZERO_SHIPPING_ATTRIBUTE)
    ? target.checked
    : undefined;
}

/**
 * Cardmarket positions the seller cards with Bootstrap's masonry, measured once at load.
 * Taller cards overlap until it measures again, which it does on a window resize.
 */
export function relayoutSellerCards(document: Document): void {
  document.defaultView?.dispatchEvent(new Event("resize"));
}

/** True when the click landed on the "Pick for OpenRift" button. */
export function isPickAllClick(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${PICK_ALL_ATTRIBUTE}]`) !== null;
}
