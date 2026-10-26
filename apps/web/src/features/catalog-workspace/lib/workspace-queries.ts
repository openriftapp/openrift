import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import type {
  WorkspaceOwner,
  WorkspaceQueueResponse,
  WorkspaceRecordRow,
  WorkspaceRecordsInput,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchWorkspaceQueue = createServerFn({ method: "GET" })
  .validator((input: { owner?: WorkspaceOwner }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceQueueResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceQueue(data),
  );

const fetchWorkspaceRecords = createServerFn({ method: "GET" })
  .validator((input: WorkspaceRecordsInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceRecordsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceRecords(data),
  );

export function workspaceQueueQueryOptions(owner?: WorkspaceOwner) {
  return queryOptions({
    queryKey: [...adminKeys.workspaceQueue, owner ?? "all"] as const,
    queryFn: () => fetchWorkspaceQueue({ data: { owner } }),
    staleTime: 60 * 1000,
  });
}

export function workspaceRecordsInfiniteQueryOptions(input: Omit<WorkspaceRecordsInput, "cursor">) {
  return infiniteQueryOptions({
    queryKey: [...adminKeys.workspaceRecords.prefix, "infinite", input] as const,
    queryFn: ({ pageParam }) => fetchWorkspaceRecords({ data: { ...input, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000,
  });
}

export async function fetchAllWorkspaceRecords(
  input: Omit<WorkspaceRecordsInput, "cursor">,
  loaded: readonly WorkspaceRecordsResponse[] = [],
): Promise<WorkspaceRecordRow[]> {
  const rows = loaded.flatMap((page) => page.rows);
  let cursor: string | null | undefined =
    loaded.length === 0 ? undefined : (loaded.at(-1)?.nextCursor ?? null);
  while (cursor !== null) {
    // oxlint-disable-next-line no-await-in-loop -- each page needs the previous page's cursor
    const page: WorkspaceRecordsResponse = await fetchWorkspaceRecords({
      data: { ...input, cursor },
    });
    rows.push(...page.rows);
    cursor = page.nextCursor;
  }
  return rows;
}
