import { adminPrintingEventsContract } from "@openrift/shared/contracts/admin/printing-events";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingEventsListResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPrintingEvents = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<PrintingEventsListResponse> =>
    apiOrpcClient(adminPrintingEventsContract, context.cookie).list(),
  );

export const PRINTING_EVENTS_REFRESH_INTERVAL_MS = 30_000;

export const adminPrintingEventsQueryOptions = queryOptions({
  queryKey: adminKeys.printingEvents,
  queryFn: () => fetchPrintingEvents(),
  refetchInterval: PRINTING_EVENTS_REFRESH_INTERVAL_MS,
});
