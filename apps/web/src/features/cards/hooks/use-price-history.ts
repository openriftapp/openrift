import { pricesContract } from "@openrift/shared/contracts/prices";
import { centsToDollars } from "@openrift/shared/money";
import type { PrintingPricesResponse } from "@openrift/shared/types/api/pricing";
import type { TimeRange } from "@openrift/shared/types/pricing";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { priceHistoryKeys } from "@/features/cards/lib/cards-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPrintingPricesFn = createServerFn({ method: "GET" })
  .validator((input: { printingId: string; range: TimeRange }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<PrintingPricesResponse> =>
    apiOrpcClient(pricesContract, context.cookie).printing({
      printingId: data.printingId,
      range: data.range,
    }),
  );

type PriceHistory = PrintingPricesResponse;

export function usePriceHistory(printingId: string | null, range: TimeRange = "30d") {
  return useQuery({
    queryKey: priceHistoryKeys.byPrinting(printingId ?? "", range),
    queryFn: () =>
      fetchPrintingPricesFn({
        // oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- guarded by enabled: Boolean(printingId)
        data: { printingId: printingId!, range },
      }),
    select: (data): PriceHistory => ({
      tcgplayer: {
        ...data.tcgplayer,
        price: centsToDollars(data.tcgplayer.price),
        snapshots: data.tcgplayer.snapshots.map((s) => ({
          date: s.date,
          market: centsToDollars(s.market),
          low: centsToDollars(s.low),
        })),
      },
      cardmarket: {
        ...data.cardmarket,
        price: centsToDollars(data.cardmarket.price),
        snapshots: data.cardmarket.snapshots.map((s) => ({
          date: s.date,
          market: centsToDollars(s.market),
          low: centsToDollars(s.low),
        })),
      },
      cardtrader: {
        ...data.cardtrader,
        price: centsToDollars(data.cardtrader.price),
        snapshots: data.cardtrader.snapshots.map((s) => ({
          date: s.date,
          zeroLow: centsToDollars(s.zeroLow),
          low: centsToDollars(s.low),
        })),
      },
      cardnexus: {
        ...data.cardnexus,
        price: centsToDollars(data.cardnexus.price),
        snapshots: data.cardnexus.snapshots.map((s) => ({
          date: s.date,
          low: centsToDollars(s.low),
        })),
      },
    }),
    enabled: Boolean(printingId),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
