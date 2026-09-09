export const CARDMARKET_MATCH_PATTERN = "https://www.cardmarket.com/*";

const OFFERS_PATH = /\/Users\/[^/]+\/Offers(?<trailer>\/|$)/u;

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
