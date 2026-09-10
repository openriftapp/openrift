import { overlayCell } from "./cardmarket-cell";
import type { CardmarketArticleRow, CardmarketFinish } from "./cardmarket-rows";
import { extractArticleRows } from "./cardmarket-rows";
import type { PickIdentity, PicksBasket } from "./picks";
import { pickedQuantity } from "./picks";

const PICK_CONTROL_ATTRIBUTE = "data-openrift-pick";
const PICK_DELTA_ATTRIBUTE = "data-openrift-pick-delta";
const PICK_COUNT_ATTRIBUTE = "data-openrift-pick-count";

const CONTROL_STYLE = [
  "order:3",
  "display:inline-flex",
  "align-items:center",
  "gap:2px",
  "white-space:nowrap",
].join(";");

const BUTTON_STYLE = [
  "display:inline-flex",
  "align-items:center",
  "justify-content:center",
  "width:20px",
  "height:20px",
  "padding:0",
  "border:1px solid #9ca3af",
  "border-radius:4px",
  "background:#fff",
  "color:#111827",
  "font-size:13px",
  "font-weight:700",
  "line-height:1",
  "cursor:pointer",
].join(";");

const COUNT_STYLE = [
  "display:inline-block",
  "min-width:16px",
  "text-align:center",
  "font-size:11px",
  "font-weight:700",
].join(";");

const PICKED_COUNT = "color:#166534";
const IDLE_COUNT = "color:#6b7280";

function identityOf(row: CardmarketArticleRow, idProduct: number): PickIdentity {
  return {
    idProduct,
    finish: row.finish,
    idLanguage: row.idLanguage ?? null,
    languageLabel: row.languageLabel ?? null,
    productName: row.productName ?? `Cardmarket product ${idProduct}`,
  };
}

function button(doc: Document, delta: number, label: string): HTMLButtonElement {
  const element = doc.createElement("button");
  element.type = "button";
  element.setAttribute(PICK_DELTA_ATTRIBUTE, String(delta));
  element.setAttribute("style", BUTTON_STYLE);
  element.setAttribute("aria-label", delta > 0 ? "Pick one more for OpenRift" : "Pick one less");
  element.textContent = label;
  return element;
}

function build(doc: Document, identity: PickIdentity): HTMLElement {
  const control = doc.createElement("span");
  control.setAttribute(PICK_CONTROL_ATTRIBUTE, "");
  control.setAttribute("style", CONTROL_STYLE);
  control.dataset.idProduct = String(identity.idProduct);
  control.dataset.finish = identity.finish;
  control.dataset.idLanguage = identity.idLanguage === null ? "" : String(identity.idLanguage);
  control.dataset.languageLabel = identity.languageLabel ?? "";
  control.dataset.productName = identity.productName;

  const count = doc.createElement("span");
  count.setAttribute(PICK_COUNT_ATTRIBUTE, "");
  control.append(button(doc, -1, "−"), count, button(doc, 1, "+"));
  return control;
}

function paint(control: HTMLElement, quantity: number): void {
  const count = control.querySelector<HTMLElement>(`[${PICK_COUNT_ATTRIBUTE}]`);
  if (count !== null) {
    count.textContent = String(quantity);
    count.setAttribute("style", `${COUNT_STYLE};${quantity > 0 ? PICKED_COUNT : IDLE_COUNT}`);
  }
  const less = control.querySelector<HTMLButtonElement>(`[${PICK_DELTA_ATTRIBUTE}="-1"]`);
  if (less !== null) {
    less.disabled = quantity === 0;
    less.style.opacity = quantity === 0 ? "0.4" : "1";
  }
}

/** Puts a pick control on every row with a product id and repaints the ones already there. */
export function renderPickControls(
  root: ParentNode,
  basket: PicksBasket,
  seller: string,
  doc: Document,
): number {
  let rendered = 0;
  for (const row of extractArticleRows(root)) {
    if (row.idProduct === undefined || row.productLink === undefined) {
      continue;
    }
    const identity = identityOf(row, row.idProduct);
    let control = row.element.querySelector<HTMLElement>(`[${PICK_CONTROL_ATTRIBUTE}]`);
    if (control === null) {
      control = build(doc, identity);
      overlayCell(row.element, doc).append(control);
    }
    paint(control, pickedQuantity(basket, seller, identity));
    rendered += 1;
  }
  return rendered;
}

export interface PickClick {
  identity: PickIdentity;
  delta: number;
}

/** The pick a click on one of the control's buttons stands for, or undefined for any other click. */
export function pickClick(target: EventTarget | null): PickClick | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const clicked = target.closest<HTMLElement>(`[${PICK_DELTA_ATTRIBUTE}]`);
  const control = clicked?.closest<HTMLElement>(`[${PICK_CONTROL_ATTRIBUTE}]`);
  if (clicked === null || clicked === undefined || control === null || control === undefined) {
    return undefined;
  }
  const delta = Number(clicked.getAttribute(PICK_DELTA_ATTRIBUTE));
  const idProduct = Number(control.dataset.idProduct);
  const finish = control.dataset.finish;
  if (!Number.isInteger(delta) || !Number.isInteger(idProduct) || idProduct <= 0) {
    return undefined;
  }
  if (finish !== "normal" && finish !== "foil") {
    return undefined;
  }
  const idLanguage = control.dataset.idLanguage;
  const languageLabel = control.dataset.languageLabel;
  return {
    delta,
    identity: {
      idProduct,
      finish: finish as CardmarketFinish,
      idLanguage: idLanguage === undefined || idLanguage === "" ? null : Number(idLanguage),
      languageLabel: languageLabel === undefined || languageLabel === "" ? null : languageLabel,
      productName: control.dataset.productName ?? `Cardmarket product ${idProduct}`,
    },
  };
}
