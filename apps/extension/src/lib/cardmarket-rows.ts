import { cardmarketLanguageId } from "./cardmarket-language";
import { parsePriceCents } from "./cardmarket-price";

export type CardmarketFinish = "normal" | "foil";

export interface CardmarketArticleRow {
  element: HTMLElement;
  idProduct: number | undefined;
  finish: CardmarketFinish;
  productLink: HTMLAnchorElement | undefined;
  productName: string | undefined;
  /** Cardmarket's numeric language id; undefined when no flag label could be placed. */
  idLanguage: number | undefined;
  languageLabel: string | undefined;
  /** Copies the row stands for: one on an offers page, the wanted amount in the wizard. */
  quantity: number;
  /** The seller's asking price per copy, in euro cents. */
  priceCents: number | undefined;
  priceElements: HTMLElement[];
}

const ROW_SELECTORS = ['[id^="stockRow"]', ".article-row", '[id^="articleRow"]'];
const PRODUCT_LINK_SELECTORS = ['.col-seller a[href*="/Products/"]', 'a[href*="/Products/"]'];
const SPECIAL_ICON_SELECTOR = ".st_SpecialIcon";
const LABELLED_ICON_SELECTOR = ".icon[aria-label], .icon[data-bs-original-title]";
const OFFER_PRICE_SELECTOR = ".color-primary";

const WIZARD_ROW_SELECTOR = ".detailed-result-card table tbody tr";
const WIZARD_ARTICLE_INPUT_SELECTOR = "input[data-id-article]";
const WIZARD_NAME_SELECTOR = ".card-name";
const WIZARD_EXTRA_ICON_SELECTOR = ".extras .icon";
const WIZARD_QUANTITY_CELL = 2;
const OWN_CELL_SELECTOR = "[data-openrift-cell]";

// The article rows carry no product id of their own; the thumbnail tooltip holds
// the only copy, as the folder name in the S3 image URL.
const PRODUCT_IMAGE_ID =
  /product-images\.s3\.cardmarket\.com\/[^"'\s]*?\/(?<productId>\d+)\/\d+\.[a-z]+/iu;

function idFromThumbnail(element: Element): number | undefined {
  for (const candidate of element.querySelectorAll<HTMLElement>(
    "[data-bs-title], [data-original-title], img",
  )) {
    const haystack =
      candidate.dataset.bsTitle ??
      candidate.dataset.originalTitle ??
      candidate.getAttribute("src") ??
      "";
    const match = PRODUCT_IMAGE_ID.exec(haystack);
    const productId = match?.groups?.productId;
    if (productId !== undefined) {
      const value = Math.trunc(Number(productId));
      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }
  }
  return undefined;
}

function iconLabel(icon: HTMLElement): string {
  return (
    icon.getAttribute("aria-label") ??
    icon.dataset.bsOriginalTitle ??
    icon.dataset.originalTitle ??
    ""
  ).trim();
}

function finishOf(element: Element, iconSelector: string): CardmarketFinish {
  for (const icon of element.querySelectorAll<HTMLElement>(iconSelector)) {
    if (iconLabel(icon).toLowerCase().includes("foil")) {
      return "foil";
    }
  }
  return "normal";
}

function languageOf(element: Element): Pick<CardmarketArticleRow, "idLanguage" | "languageLabel"> {
  for (const icon of element.querySelectorAll<HTMLElement>(LABELLED_ICON_SELECTOR)) {
    if (icon.matches(SPECIAL_ICON_SELECTOR)) {
      continue;
    }
    const label = iconLabel(icon);
    const idLanguage = cardmarketLanguageId(label);
    if (idLanguage !== undefined) {
      return { idLanguage, languageLabel: label };
    }
  }
  return { idLanguage: undefined, languageLabel: undefined };
}

function productLinkOf(element: Element): HTMLAnchorElement | undefined {
  for (const selector of PRODUCT_LINK_SELECTORS) {
    const found = element.querySelector<HTMLAnchorElement>(selector);
    if (found !== null) {
      return found;
    }
  }
  return undefined;
}

function pricedElements(
  elements: Iterable<HTMLElement>,
): Pick<CardmarketArticleRow, "priceCents" | "priceElements"> {
  const priceElements: HTMLElement[] = [];
  let priceCents: number | undefined;
  for (const element of elements) {
    const cents = parsePriceCents(element.textContent ?? "");
    if (cents !== undefined) {
      priceElements.push(element);
      priceCents ??= cents;
    }
  }
  return { priceCents, priceElements };
}

function nonEmpty(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function rowElements(root: ParentNode): HTMLElement[] {
  for (const selector of ROW_SELECTORS) {
    const found = [...root.querySelectorAll<HTMLElement>(selector)];
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

/** A seller's offers page: one row per article on sale. */
export function extractArticleRows(root: ParentNode): CardmarketArticleRow[] {
  return rowElements(root).map((element) => {
    const productLink = productLinkOf(element);
    return {
      element,
      idProduct: idFromThumbnail(element),
      finish: finishOf(element, SPECIAL_ICON_SELECTOR),
      productLink,
      productName: nonEmpty(productLink?.textContent),
      ...languageOf(element),
      quantity: 1,
      ...pricedElements(element.querySelectorAll<HTMLElement>(OFFER_PRICE_SELECTOR)),
    };
  });
}

function wizardQuantity(element: HTMLElement): number {
  const cell = element.children.item(WIZARD_QUANTITY_CELL);
  const value = Math.trunc(Number(cell?.textContent?.trim()));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/**
 * The shopping wizard's result summary: one desktop table per seller, one row per
 * wanted article. The mobile copies of the same rows carry no thumbnail and are skipped.
 */
export function extractWizardRows(root: ParentNode): CardmarketArticleRow[] {
  return [...root.querySelectorAll<HTMLElement>(WIZARD_ROW_SELECTOR)]
    .filter((element) => element.querySelector(WIZARD_ARTICLE_INPUT_SELECTOR) !== null)
    .map((element) => {
      // The price is the last of Cardmarket's cells; a repaint finds this extension's own behind it.
      const priceCell = [...element.children].findLast((cell) => !cell.matches(OWN_CELL_SELECTOR));
      return {
        element,
        idProduct: idFromThumbnail(element),
        finish: finishOf(element, WIZARD_EXTRA_ICON_SELECTOR),
        productLink: undefined,
        productName: nonEmpty(element.querySelector(WIZARD_NAME_SELECTOR)?.textContent),
        ...languageOf(element),
        quantity: wizardQuantity(element),
        ...pricedElements(priceCell instanceof HTMLElement ? [priceCell] : []),
      };
    });
}

/** Whichever of the two Cardmarket pages this is; an offers page never holds wizard tables. */
export function extractCardmarketRows(root: ParentNode): CardmarketArticleRow[] {
  const offers = extractArticleRows(root);
  return offers.length > 0 ? offers : extractWizardRows(root);
}
