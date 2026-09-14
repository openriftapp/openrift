import type {
  DeskCardPrintingsOutput,
  DeskGetOutput,
  DeskListOutput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { adminPrintingDeskContract } from "@openrift/shared/contracts/admin/printing-desk";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type DeskListMode = "mine" | "all";

const fetchDeskPrintings = createServerFn({ method: "GET" })
  .validator((input: { mode: DeskListMode }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeskListOutput> =>
    apiOrpcClient(adminPrintingDeskContract, context.cookie).list({ mode: data.mode }),
  );

const fetchDeskCardPrintings = createServerFn({ method: "GET" })
  .validator((input: { cardSlug: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeskCardPrintingsOutput> =>
    apiOrpcClient(adminPrintingDeskContract, context.cookie).cardPrintings({
      cardSlug: data.cardSlug,
    }),
  );

const fetchDeskPrinting = createServerFn({ method: "GET" })
  .validator((input: { printingId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeskGetOutput> =>
    apiOrpcClient(adminPrintingDeskContract, context.cookie).get({ printingId: data.printingId }),
  );

export const deskPrintingsQueryOptions = (mode: DeskListMode) =>
  queryOptions({
    queryKey: adminKeys.printingDesk.list(mode),
    queryFn: () => fetchDeskPrintings({ data: { mode } }),
    staleTime: 60 * 1000,
  });

export const deskCardPrintingsQueryOptions = (cardSlug: string) =>
  queryOptions({
    queryKey: adminKeys.printingDesk.cardPrintings(cardSlug),
    queryFn: () => fetchDeskCardPrintings({ data: { cardSlug } }),
    staleTime: 60 * 1000,
  });

export const deskPrintingQueryOptions = (printingId: string) =>
  queryOptions({
    queryKey: adminKeys.printingDesk.printing(printingId),
    queryFn: () => fetchDeskPrinting({ data: { printingId } }),
    staleTime: 60 * 1000,
  });
