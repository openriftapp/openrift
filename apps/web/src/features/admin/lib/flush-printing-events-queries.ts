import { adminPrintingEventsContract } from "@openrift/shared/contracts/admin/printing-events";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { PrintingEventsListResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const PRINTING_EVENTS_KEY = ["admin", "printing-events"] as const;

const fetchPrintingEvents = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<PrintingEventsListResponse> =>
    apiOrpcClient(adminPrintingEventsContract, context.cookie).list(),
  );

export const PRINTING_EVENTS_REFRESH_INTERVAL_MS = 30_000;

export const adminPrintingEventsQueryOptions = queryOptions({
  queryKey: PRINTING_EVENTS_KEY,
  queryFn: () => fetchPrintingEvents(),
  refetchInterval: PRINTING_EVENTS_REFRESH_INTERVAL_MS,
});
