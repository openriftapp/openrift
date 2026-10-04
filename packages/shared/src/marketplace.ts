import type { Marketplace } from "./types/pricing.js";

const AFFILIATE_BASE = "https://partner.tcgplayer.com/openrift";

export function affiliateUrl(url: string): string {
  return `${AFFILIATE_BASE}?u=${encodeURIComponent(url)}`;
}

const CT_SHARE_CODE = "openrift";

export function cardtraderAffiliateUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}share_code=${CT_SHARE_CODE}`;
}

// Numeric language ids from Cardmarket's own docs.
const CARDMARKET_LANGUAGE_CODES: Record<string, number> = {
  EN: 1,
  FR: 2,
  DE: 3,
  ES: 4,
  IT: 5,
  "ZH-CN": 6,
  SC: 6,
  ZH: 6,
  JA: 7,
  PT: 8,
  RU: 9,
  KO: 10,
  KR: 10,
  "ZH-TW": 11,
  TC: 11,
};

// Cardmarket is the only marketplace with a language query param: TCGplayer keys language into the productId, CardTrader into the listing.
export function cardmarketLangParam(language: string | null | undefined): string {
  if (!language) {
    return "";
  }
  const code = CARDMARKET_LANGUAGE_CODES[language.toUpperCase()];
  return code === undefined ? "" : `&language=${code}`;
}

export const CARDMARKET_WANTS_URL = "https://www.cardmarket.com/en/Riftbound/Wants";

export const CARDTRADER_WISHLIST_URL = cardtraderAffiliateUrl(
  "https://www.cardtrader.com/wishlists/new",
);

const TCGPLAYER_MASS_ENTRY_PRODUCT_LINE = "Riftbound League of Legends Trading Card Game";

export interface MassEntryLine {
  productId: number;
  quantity: number;
}

/** Mass Entry reads `c` as `qty-productId` entries joined by `||`; it only selects the game by the product line's internal name. */
export function tcgplayerMassEntryUrl(lines: readonly MassEntryLine[]): string {
  const entries = lines.map((line) => `${line.quantity}-${line.productId}`).join("||");
  return affiliateUrl(
    `https://www.tcgplayer.com/massentry?productline=${encodeURIComponent(TCGPLAYER_MASS_ENTRY_PRODUCT_LINE)}&c=${entries}`,
  );
}

const CARDNEXUS_MP_ID = "7018965";
const CARDNEXUS_AFFILIATE_BASE = `https://af.cardnexus.link/${CARDNEXUS_MP_ID}`;
// af.cardnexus.link search drops query params; switch to it once it keeps `game=riftbound`.
const CARDNEXUS_DEEP_LINK_BASE = `https://go.cardnexus.link/c/${CARDNEXUS_MP_ID}/3770197/48046`;
const CARDNEXUS_CART_WIZARD_MAX_LINES = 400;

const CARDNEXUS_LANGUAGE_CODES: Record<string, string> = {
  KR: "ko",
  SC: "zh-Hans",
  ZH: "zh-Hans",
  TC: "zh-Hant",
};

const CARDNEXUS_FINISH_CODES: Record<string, string> = {
  normal: "s",
  foil: "f",
};

export interface CartWizardLine {
  productId: number;
  quantity: number;
  language?: string | null;
  finish?: string | null;
}

function cardnexusLanguage(language: string | null | undefined): string {
  if (!language) {
    return "";
  }
  const upper = language.toUpperCase();
  return CARDNEXUS_LANGUAGE_CODES[upper] ?? language.toLowerCase();
}

/** Cart Wizard reads `{productId}.{quantity}.{language}.{finish}` lines joined by `~`; an empty field means any. */
export function cardnexusCartWizardUrl(lines: readonly CartWizardLine[]): string {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const language = cardnexusLanguage(line.language);
    const finish = CARDNEXUS_FINISH_CODES[line.finish ?? ""] ?? "";
    const key = `${line.productId}.${language}.${finish}`;
    quantities.set(key, (quantities.get(key) ?? 0) + line.quantity);
  }
  const entries = [...quantities]
    .slice(0, CARDNEXUS_CART_WIZARD_MAX_LINES)
    .map(([key, quantity]) => {
      const [productId, language, finish] = key.split(".");
      return `${productId}.${quantity}.${language}.${finish}`.replace(/\.+$/u, "");
    })
    .join("~");
  return `${CARDNEXUS_AFFILIATE_BASE}/products/cn/${entries}`;
}

interface MarketplaceLinks {
  label: string;
  searchUrl: (query: string) => string;
  productUrl: (productId: number, language?: string | null) => string;
  isAffiliate: boolean;
}

export const MARKETPLACE_LINKS: Record<Marketplace, MarketplaceLinks> = {
  tcgplayer: {
    label: "TCGplayer",
    searchUrl: (query) =>
      affiliateUrl(
        `https://www.tcgplayer.com/search/riftbound/product?q=${encodeURIComponent(query)}`,
      ),
    productUrl: (id) => affiliateUrl(`https://www.tcgplayer.com/product/${id}`),
    isAffiliate: true,
  },
  cardmarket: {
    label: "Cardmarket",
    searchUrl: (query) =>
      `https://www.cardmarket.com/en/Riftbound/Products/Search?searchString=${encodeURIComponent(query)}`,
    productUrl: (id, language) =>
      `https://www.cardmarket.com/en/Riftbound/Products?idProduct=${id}${cardmarketLangParam(language)}`,
    isAffiliate: false,
  },
  cardtrader: {
    label: "CardTrader",
    searchUrl: (query) =>
      cardtraderAffiliateUrl(`https://www.cardtrader.com/en/search?q=${encodeURIComponent(query)}`),
    productUrl: (id) => cardtraderAffiliateUrl(`https://www.cardtrader.com/en/cards/${id}`),
    isAffiliate: true,
  },
  cardnexus: {
    label: "CardNexus",
    searchUrl: (query) =>
      `${CARDNEXUS_DEEP_LINK_BASE}?u=${encodeURIComponent(
        `https://cardnexus.com/en/search?q=${encodeURIComponent(query)}&game=riftbound`,
      )}`,
    productUrl: (id) => `${CARDNEXUS_AFFILIATE_BASE}/cn/${id}`,
    isAffiliate: true,
  },
};

export function marketplaceLabel(name: string): string {
  return MARKETPLACE_LINKS[name as Marketplace]?.label ?? name;
}
