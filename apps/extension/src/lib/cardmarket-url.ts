export const CARDMARKET_MATCH_PATTERN = "https://www.cardmarket.com/*";

const OFFERS_PATH = /\/Users\/(?<seller>[^/]+)\/Offers(?<trailer>\/|$)/u;

/** The seller whose offers the page shows, undefined off an offers page. */
export function cardmarketSellerFromUrl(url: string): string | undefined {
  if (!isCardmarketOffersUrl(url)) {
    return undefined;
  }
  const seller = OFFERS_PATH.exec(new URL(url).pathname)?.groups?.seller;
  return seller === undefined ? undefined : decodeURIComponent(seller);
}

/** Riftbound only: the snapshot carries no other game's products. */
export function isCardmarketOffersUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.cardmarket.com") {
      return false;
    }
    return parsed.pathname.includes("/Riftbound/") && OFFERS_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}
