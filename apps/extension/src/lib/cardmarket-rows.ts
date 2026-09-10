import { cardmarketLanguageId } from "./cardmarket-language";

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
}

const ROW_SELECTORS = ['[id^="stockRow"]', ".article-row", '[id^="articleRow"]'];
const PRODUCT_LINK_SELECTORS = ['.col-seller a[href*="/Products/"]', 'a[href*="/Products/"]'];
const SPECIAL_ICON_SELECTOR = ".st_SpecialIcon";
const LABELLED_ICON_SELECTOR = ".icon[aria-label], .icon[data-bs-original-title]";

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
  return (icon.getAttribute("aria-label") ?? icon.dataset.bsOriginalTitle ?? "").trim();
}

function finishOf(element: Element): CardmarketFinish {
  for (const icon of element.querySelectorAll<HTMLElement>(SPECIAL_ICON_SELECTOR)) {
    const label = `${icon.getAttribute("aria-label") ?? ""} ${icon.dataset.originalTitle ?? ""}`;
    if (label.toLowerCase().includes("foil")) {
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

function rowElements(root: ParentNode): HTMLElement[] {
  for (const selector of ROW_SELECTORS) {
    const found = [...root.querySelectorAll<HTMLElement>(selector)];
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

export function extractArticleRows(root: ParentNode): CardmarketArticleRow[] {
  return rowElements(root).map((element) => {
    const productLink = productLinkOf(element);
    const productName = productLink?.textContent?.trim();
    return {
      element,
      idProduct: idFromThumbnail(element),
      finish: finishOf(element),
      productLink,
      productName: productName === undefined || productName.length === 0 ? undefined : productName,
      ...languageOf(element),
    };
  });
}
