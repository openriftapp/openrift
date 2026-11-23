import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import type {
  WorkspaceQueueResponse,
  WorkspaceRecordsInput,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchWorkspaceQueue = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceQueueResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceQueue({}),
  );

const fetchCardImages = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(async ({ context }): Promise<Record<string, string>> => {
    const response = await apiOrpcClient(
      adminCatalogWorkspaceContract,
      context.cookie,
    ).workspaceCardImages();
    return response.images;
  });

export function cardImagesQueryOptions() {
  return queryOptions({
    queryKey: [...adminKeys.workspace, "card-images"] as const,
    queryFn: () => fetchCardImages(),
    staleTime: 10 * MINUTE_MS,
  });
}

const fetchWorkspaceRecords = createServerFn({ method: "GET" })
  .validator((input: WorkspaceRecordsInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceRecordsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceRecords(data),
  );

export function workspaceQueueQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.workspaceQueue,
    queryFn: () => fetchWorkspaceQueue(),
    staleTime: MINUTE_MS,
  });
}

export function workspaceRecordsInfiniteQueryOptions(input: Omit<WorkspaceRecordsInput, "cursor">) {
  return infiniteQueryOptions({
    queryKey: adminKeys.workspaceRecords.infinite(input),
    queryFn: ({ pageParam }) => fetchWorkspaceRecords({ data: { ...input, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: MINUTE_MS,
  });
}
