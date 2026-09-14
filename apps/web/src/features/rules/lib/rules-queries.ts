import { rulesContract } from "@openrift/shared/contracts/rules";
import type {
  RuleKind,
  RulesListResponse,
  RuleVersionsListResponse,
} from "@openrift/shared/types/api/rules";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { rulesKeys } from "@/features/rules/lib/rules-query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchRulesAtVersion = createServerFn({ method: "GET" })
  .validator((input: { kind: RuleKind; version: string }) => input)
  .handler(({ data }): Promise<RulesListResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "rules", data.kind, data.version],
      queryFn: () => apiOrpcClient(rulesContract).list({ kind: data.kind, version: data.version }),
    }),
  );

const fetchVersions = createServerFn({ method: "GET" })
  .validator((input: { kind?: RuleKind } | undefined) => input ?? {})
  .handler(({ data }): Promise<RuleVersionsListResponse> => {
    const cacheKey = data.kind
      ? ["server-cache", "rules-versions", data.kind]
      : ["server-cache", "rules-versions"];
    return serverCache.query({
      queryKey: cacheKey,
      queryFn: () => apiOrpcClient(rulesContract).versions(data.kind ? { kind: data.kind } : {}),
    });
  });

export function rulesAtVersionQueryOptions(kind: RuleKind, version: string) {
  return queryOptions({
    queryKey: rulesKeys.byVersion(kind, version),
    queryFn: () => fetchRulesAtVersion({ data: { kind, version } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function ruleVersionsQueryOptions(kind?: RuleKind) {
  return queryOptions({
    queryKey: kind ? rulesKeys.versions(kind) : (["rules", "versions", "all"] as const),
    queryFn: () => fetchVersions({ data: kind ? { kind } : undefined }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
