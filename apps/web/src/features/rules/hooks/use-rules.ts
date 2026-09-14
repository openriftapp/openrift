import { adminRulesContract } from "@openrift/shared/contracts/admin/rules";
import type { RuleKind } from "@openrift/shared/types/api/rules";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  ruleVersionsQueryOptions,
  rulesAtVersionQueryOptions,
} from "@/features/rules/lib/rules-queries";
import { serverCache } from "@/lib/server-cache";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useRulesAtVersion(kind: RuleKind, version: string) {
  return useSuspenseQuery(rulesAtVersionQueryOptions(kind, version));
}

export function useRuleVersions(kind?: RuleKind) {
  return useSuspenseQuery(ruleVersionsQueryOptions(kind));
}

const importRulesFn = createServerFn({ method: "POST" })
  .validator(
    (input: { kind: RuleKind; version: string; comments?: string | null; content: string }) =>
      input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const result = await apiOrpcClient(adminRulesContract, context.cookie).import({
      kind: data.kind,
      version: data.version,
      comments: data.comments,
      content: data.content,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules"] });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
    return result;
  });

export function useImportRules() {
  return useMutationWithInvalidation({
    mutationFn: (vars: {
      kind: RuleKind;
      version: string;
      comments?: string | null;
      content: string;
    }) => importRulesFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}

const deleteRuleVersionFn = createServerFn({ method: "POST" })
  .validator((input: { kind: RuleKind; version: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminRulesContract, context.cookie).removeVersion({
      kind: data.kind,
      version: data.version,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules"] });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
  });

export function useDeleteRuleVersion() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { kind: RuleKind; version: string }) => deleteRuleVersionFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}

const updateRuleVersionCommentsFn = createServerFn({ method: "POST" })
  .validator((input: { kind: RuleKind; version: string; comments: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const result = await apiOrpcClient(adminRulesContract, context.cookie).updateVersion({
      kind: data.kind,
      version: data.version,
      comments: data.comments,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
    return result;
  });

export function useUpdateRuleVersionComments() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { kind: RuleKind; version: string; comments: string | null }) =>
      updateRuleVersionCommentsFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}
