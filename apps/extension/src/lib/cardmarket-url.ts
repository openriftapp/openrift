export const CARDMARKET_MATCH_PATTERN = "https://www.cardmarket.com/*";

const OFFERS_PATH = /\/Users\/(?<seller>[^/]+)\/Offers(?<trailer>\/|$)/u;
const WIZARD_RESULT_PATH = /\/Wants\/ShoppingWizard\/Results\/[^/]+/u;

export type CardmarketPageKind = "offers" | "wizard";

/** The seller whose offers the page shows, undefined off an offers page. */
export function cardmarketSellerFromUrl(url: string): string | undefined {
  if (!isCardmarketOffersUrl(url)) {
    return undefined;
  }
  const seller = OFFERS_PATH.exec(new URL(url).pathname)?.groups?.seller;
  return seller === undefined ? undefined : decodeURIComponent(seller);
}

function riftboundPath(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.cardmarket.com" || !parsed.pathname.includes("/Riftbound/")) {
      return undefined;
    }
    return parsed.pathname;
  } catch {
    return undefined;
  }
}

/** Riftbound only: the snapshot carries no other game's products. */
export function isCardmarketOffersUrl(url: string): boolean {
  return cardmarketPageKind(url) === "offers";
}

export function isCardmarketWizardResultUrl(url: string): boolean {
  return cardmarketPageKind(url) === "wizard";
}

/** The pages the extension marks: a seller's offers and a shopping wizard result. */
export function cardmarketPageKind(url: string): CardmarketPageKind | undefined {
  const path = riftboundPath(url);
  if (path === undefined) {
    return undefined;
  }
  if (OFFERS_PATH.test(path)) {
    return "offers";
  }
  return WIZARD_RESULT_PATH.test(path) ? "wizard" : undefined;
}
