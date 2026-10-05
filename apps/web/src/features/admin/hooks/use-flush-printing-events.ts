import { adminPrintingEventsContract } from "@openrift/shared/contracts/admin/printing-events";
import type { JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminPrintingEventsQueryOptions } from "@/features/admin/lib/flush-printing-events-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface WebhookFailure {
  channel: "newPrintings";
  status?: number;
  detail: string;
}

export interface FlushPrintingEventsResult {
  sent: number;
  failed: number;
  failures?: WebhookFailure[];
}

export const FLUSH_PRINTING_EVENTS_KIND = "discord.flush_printing_events";

const flushPrintingEventsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<JobRunStartedResponse> =>
    apiOrpcClient(adminPrintingEventsContract, context.cookie).flush(),
  );

export function useFlushPrintingEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => flushPrintingEventsFn(),
    onSuccess: () => {
      // Surface the new running row immediately and refresh the queue list
      // once the flush completes; the run-poll hook drives intermediate state.
      void queryClient.invalidateQueries({
        queryKey: adminKeys.jobRunsByKind(FLUSH_PRINTING_EVENTS_KIND),
      });
      void queryClient.invalidateQueries({ queryKey: adminKeys.printingEvents });
    },
  });
}

export function isFlushPrintingEventsResult(value: unknown): value is FlushPrintingEventsResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { sent?: unknown; failed?: unknown };
  return typeof candidate.sent === "number" && typeof candidate.failed === "number";
}

export function useAdminPrintingEvents() {
  return useQuery(adminPrintingEventsQueryOptions);
}

const retryPrintingEventsFn = createServerFn({ method: "POST" })
  .validator((input: { ids: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ retried: number }> =>
    apiOrpcClient(adminPrintingEventsContract, context.cookie).retry(data),
  );

export function useRetryPrintingEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => retryPrintingEventsFn({ data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.printingEvents }),
  });
}
