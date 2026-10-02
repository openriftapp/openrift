import { rulesContract } from "@openrift/shared/contracts/rules";
import type {
  RuleKind,
  RuleLanguage,
  RulesPageResponse,
  RuleSourceResponse,
  RuleVersionsListResponse,
} from "@openrift/shared/types/api/rules";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { rulesKeys } from "@/features/rules/lib/rules-query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface RulesDocumentInput {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
}

const fetchRulesAtVersion = createServerFn({ method: "GET" })
  .validator((input: RulesDocumentInput) => input)
  .handler(({ data }): Promise<RulesPageResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "rules", data.kind, data.language, data.version, "page"],
      queryFn: () => apiOrpcClient(rulesContract).page(data),
    }),
  );

const fetchRulesSource = createServerFn({ method: "GET" })
  .validator((input: RulesDocumentInput) => input)
  .handler(({ data }): Promise<RuleSourceResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "rules", data.kind, data.language, data.version, "source"],
      queryFn: () => apiOrpcClient(rulesContract).source(data),
    }),
  );

const fetchVersions = createServerFn({ method: "GET" })
  .validator((input: { kind?: RuleKind; language: RuleLanguage }) => input)
  .handler(({ data }): Promise<RuleVersionsListResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "rules-versions", data.language, data.kind ?? "all"],
      queryFn: () => apiOrpcClient(rulesContract).versions(data),
    }),
  );

export function rulesAtVersionQueryOptions(
  kind: RuleKind,
  language: RuleLanguage,
  version: string,
) {
  return queryOptions({
    queryKey: rulesKeys.byVersion(kind, language, version),
    queryFn: () => fetchRulesAtVersion({ data: { kind, language, version } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function rulesSourceQueryOptions(kind: RuleKind, language: RuleLanguage, version: string) {
  return queryOptions({
    queryKey: rulesKeys.source(kind, language, version),
    queryFn: () => fetchRulesSource({ data: { kind, language, version } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function ruleVersionsQueryOptions(kind: RuleKind, language: RuleLanguage = "en") {
  return queryOptions({
    queryKey: rulesKeys.versions(kind, language),
    queryFn: () => fetchVersions({ data: { kind, language } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
