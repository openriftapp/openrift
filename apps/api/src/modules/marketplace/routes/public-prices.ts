import { pricesContract } from "@openrift/shared/contracts/prices";
import { formatDay } from "@openrift/shared/format-date";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type {
  MarketplaceLink,
  MarketplaceLinksResponse,
  PriceMap,
  PricesResponse,
  PrintingMarketplaceLinks,
  PrintingPricesResponse,
} from "@openrift/shared/types/api/pricing";
import { MARKETPLACE_CURRENCY, TIME_RANGE_DAYS } from "@openrift/shared/types/pricing";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import type { MarketplaceSourceRow } from "../repositories/marketplace-prices.js";

const os = implement(pricesContract).$context<ApiContext>().use(requireUser);

function emptyLink(): MarketplaceLink {
  return { available: false, productId: null, url: null };
}

function emptyLinks(): PrintingMarketplaceLinks {
  return {
    tcgplayer: emptyLink(),
    cardmarket: emptyLink(),
    cardtrader: emptyLink(),
    cardnexus: emptyLink(),
  };
}

function linksFromSources(
  rows: readonly MarketplaceSourceRow[],
  printingIds?: readonly string[],
): MarketplaceLinksResponse["links"] {
  const links: MarketplaceLinksResponse["links"] = {};
  for (const printingId of printingIds ?? []) {
    links[printingId] = emptyLinks();
  }
  for (const row of rows) {
    const entry = links[row.printingId] ?? emptyLinks();
    links[row.printingId] = entry;
    const source = row.marketplace as Marketplace;
    entry[source] = {
      available: true,
      productId: row.externalId,
      url: MARKETPLACE_LINKS[source].productUrl(row.externalId, row.language),
    };
  }
  return links;
}

/**
 * Public price reads. Amounts are integer cents; the web converts at the display boundary.
 */
export const pricesRouter = {
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

  links: os.links.handler(async ({ input, context }): Promise<MarketplaceLinksResponse> => {
    const { marketplace } = context.repos;
    const { printings } = input;

    const rows = printings
      ? await marketplace.sourcesForPrintings(printings)
      : await marketplace.sourcesForAllPrintings();

    return { links: linksFromSources(rows, printings) };
  }),

  printing: os.printing.handler(
    async ({ input, context, errors }): Promise<PrintingPricesResponse> => {
      const { catalog, marketplace } = context.repos;

      const { printingId, range } = input;
      const days = TIME_RANGE_DAYS[range];
      const cutoff = days ? new Date(Date.now() - days * 86_400_000) : null;

      const printing = await catalog.getPrintingById(printingId);
      if (!printing) {
        throw errors.NOT_FOUND({ message: `Printing not found: ${printingId}` });
      }

      const [sources, linkRows, priceRows] = await Promise.all([
        marketplace.sourcesForPrinting(printingId),
        marketplace.sourcesForPrintings([printingId]),
        marketplace.latestPricesForPrintings([printingId]),
      ]);
      const links = linksFromSources(linkRows, [printingId])[printingId] ?? emptyLinks();
      const priceOf = (source: Marketplace): number | null =>
        priceRows.find((row) => row.marketplace === source)?.marketCents ?? null;
      const variantOf = (source: Marketplace): string | undefined =>
        sources.find((s) => s.marketplace === source)?.variantId;

      const snapshotsOf = (source: Marketplace) => {
        const variantId = variantOf(source);
        return variantId ? marketplace.snapshots(variantId, cutoff) : [];
      };
      const [tcgRows, cmRows, ctRows, cnRows] = await Promise.all([
        snapshotsOf("tcgplayer"),
        snapshotsOf("cardmarket"),
        snapshotsOf("cardtrader"),
        snapshotsOf("cardnexus"),
      ]);

      const tcgSnapshots: PrintingPricesResponse["tcgplayer"]["snapshots"] = [];
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

      const cmSnapshots: PrintingPricesResponse["cardmarket"]["snapshots"] = [];
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

      const ctSnapshots: PrintingPricesResponse["cardtrader"]["snapshots"] = [];
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

      const cnSnapshots: PrintingPricesResponse["cardnexus"]["snapshots"] = [];
      for (const r of cnRows) {
        if (r.lowCents === null) {
          continue;
        }
        cnSnapshots.push({ date: formatDay(r.recordedAt), low: r.lowCents });
      }

      return {
        tcgplayer: {
          ...links.tcgplayer,
          currency: MARKETPLACE_CURRENCY.tcgplayer,
          price: priceOf("tcgplayer"),
          snapshots: tcgSnapshots,
        },
        cardmarket: {
          ...links.cardmarket,
          currency: MARKETPLACE_CURRENCY.cardmarket,
          price: priceOf("cardmarket"),
          snapshots: cmSnapshots,
        },
        cardtrader: {
          ...links.cardtrader,
          currency: MARKETPLACE_CURRENCY.cardtrader,
          price: priceOf("cardtrader"),
          snapshots: ctSnapshots,
        },
        cardnexus: {
          ...links.cardnexus,
          currency: MARKETPLACE_CURRENCY.cardnexus,
          price: priceOf("cardnexus"),
          snapshots: cnSnapshots,
        },
      };
    },
  ),
};
