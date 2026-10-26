import { pricesContract } from "@openrift/shared/contracts/prices";
import { formatDay } from "@openrift/shared/format-date";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type {
  MarketplaceLinkInfo,
  MarketplaceInfoResponse,
  PriceHistoryResponse,
  PriceMap,
  PricesResponse,
} from "@openrift/shared/types/api/pricing";
import { MARKETPLACE_CURRENCY, TIME_RANGE_DAYS } from "@openrift/shared/types/pricing";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(pricesContract).$context<ApiContext>().use(requireUser);

function emptyMarketplaceInfo(): MarketplaceLinkInfo {
  return {
    available: false,
    productId: null,
    url: null,
  };
}

/**
 * Public price reads. An unknown printing in `history` resolves to an `available: false` payload (200), not a 404.
 */
export const pricesRouter = {
  /**
   * `GET /prices` — latest market price per marketplace for every printing.
   * Returned as `{ [printingId]: { tcgplayer?, cardmarket?, cardtrader?, cardnexus? } }`
   * with integer-cents amounts; the web converts at the display boundary.
   */
  prices: os.prices.handler(async ({ context }): Promise<PricesResponse> => {
    const { marketplace } = context.repos;

    const rows = await marketplace.latestPrices();

    const prices: PriceMap = {};
    for (const row of rows) {
      let entry = prices[row.printingId];
      if (!entry) {
        entry = {};
        prices[row.printingId] = entry;
      }
      entry[row.marketplace as Marketplace] = row.marketCents;
    }

    return { prices, currencies: MARKETPLACE_CURRENCY };
  }),

  /**
   * `GET /prices/marketplace-info?printings=uuid1,uuid2,...` — batch source
   * metadata (productId / available) so the frontend can craft deep-link
   * marketplace URLs for an arbitrary set of printings in one request.
   */
  marketplaceInfo: os.marketplaceInfo.handler(
    async ({ input, context }): Promise<MarketplaceInfoResponse> => {
      const { marketplace } = context.repos;
      const { printings } = input;

      const rows = await marketplace.sourcesForPrintings(printings);

      const infos: MarketplaceInfoResponse["infos"] = {};
      for (const printingId of printings) {
        infos[printingId] = {
          tcgplayer: emptyMarketplaceInfo(),
          cardmarket: emptyMarketplaceInfo(),
          cardtrader: emptyMarketplaceInfo(),
          cardnexus: emptyMarketplaceInfo(),
        };
      }
      for (const row of rows) {
        const entry = infos[row.printingId];
        if (!entry) {
          continue;
        }
        const source = row.marketplace as Marketplace;
        entry[source] = {
          available: true,
          productId: row.externalId,
          url: MARKETPLACE_LINKS[source].productUrl(row.externalId, row.language),
        };
      }

      return { infos };
    },
  ),

  /**
   * `GET /prices/:printingId/history` — price history for a single printing.
   * Returns snapshots for TCGPlayer (USD), Cardmarket, CardTrader and CardNexus
   * (EUR) when available; `range` (`7d`/`30d`/`90d`/`all`) controls the window.
   * An unknown printing / source returns `available: false` (not a 404).
   */
  history: os.history.handler(async ({ input, context }): Promise<PriceHistoryResponse> => {
    const { catalog, marketplace } = context.repos;

    const { printingId, range } = input;
    const days = TIME_RANGE_DAYS[range];
    const cutoff = days ? new Date(Date.now() - days * 86_400_000) : null;

    const [printing, sources] = await Promise.all([
      catalog.getPrintingById(printingId),
      marketplace.sourcesForPrinting(printingId),
    ]);

    if (!printing) {
      return {
        tcgplayer: {
          available: false,
          productId: null,
          currency: MARKETPLACE_CURRENCY.tcgplayer,
          snapshots: [],
        },
        cardmarket: {
          available: false,
          productId: null,
          currency: MARKETPLACE_CURRENCY.cardmarket,
          snapshots: [],
        },
        cardtrader: {
          available: false,
          productId: null,
          currency: MARKETPLACE_CURRENCY.cardtrader,
          snapshots: [],
        },
        cardnexus: {
          available: false,
          productId: null,
          currency: MARKETPLACE_CURRENCY.cardnexus,
          snapshots: [],
        },
      };
    }

    const tcgSource = sources.find((s) => s.marketplace === ("tcgplayer" satisfies Marketplace));
    const cmSource = sources.find((s) => s.marketplace === ("cardmarket" satisfies Marketplace));
    const ctSource = sources.find((s) => s.marketplace === ("cardtrader" satisfies Marketplace));
    const cnSource = sources.find((s) => s.marketplace === ("cardnexus" satisfies Marketplace));

    const [tcgRows, cmRows, ctRows, cnRows] = await Promise.all([
      tcgSource ? marketplace.snapshots(tcgSource.variantId, cutoff) : [],
      cmSource ? marketplace.snapshots(cmSource.variantId, cutoff) : [],
      ctSource ? marketplace.snapshots(ctSource.variantId, cutoff) : [],
      cnSource ? marketplace.snapshots(cnSource.variantId, cutoff) : [],
    ]);

    const tcgSnapshots: PriceHistoryResponse["tcgplayer"]["snapshots"] = [];
    for (const r of tcgRows) {
      if (r.marketCents === null) {
        continue;
      }
      tcgSnapshots.push({
        date: formatDay(r.recordedAt),
        market: r.marketCents,
        low: r.lowCents,
      });
    }

    const cmSnapshots: PriceHistoryResponse["cardmarket"]["snapshots"] = [];
    for (const r of cmRows) {
      const market = r.marketCents ?? r.lowCents;
      if (market === null) {
        continue;
      }
      cmSnapshots.push({
        date: formatDay(r.recordedAt),
        market,
        low: r.lowCents,
      });
    }

    const ctSnapshots: PriceHistoryResponse["cardtrader"]["snapshots"] = [];
    for (const r of ctRows) {
      if (r.zeroLowCents === null && r.lowCents === null) {
        continue;
      }
      ctSnapshots.push({
        date: formatDay(r.recordedAt),
        zeroLow: r.zeroLowCents,
        low: r.lowCents,
      });
    }

    const cnSnapshots: PriceHistoryResponse["cardnexus"]["snapshots"] = [];
    for (const r of cnRows) {
      if (r.lowCents === null) {
        continue;
      }
      cnSnapshots.push({ date: formatDay(r.recordedAt), low: r.lowCents });
    }

    return {
      tcgplayer: {
        available: Boolean(tcgSource),
        productId: tcgSource?.externalId ?? null,
        currency: MARKETPLACE_CURRENCY.tcgplayer,
        snapshots: tcgSnapshots,
      },
      cardmarket: {
        available: Boolean(cmSource),
        productId: cmSource?.externalId ?? null,
        currency: MARKETPLACE_CURRENCY.cardmarket,
        snapshots: cmSnapshots,
      },
      cardtrader: {
        available: Boolean(ctSource),
        productId: ctSource?.externalId ?? null,
        currency: MARKETPLACE_CURRENCY.cardtrader,
        snapshots: ctSnapshots,
      },
      cardnexus: {
        available: Boolean(cnSource),
        productId: cnSource?.externalId ?? null,
        currency: MARKETPLACE_CURRENCY.cardnexus,
        snapshots: cnSnapshots,
      },
    };
  }),
};
