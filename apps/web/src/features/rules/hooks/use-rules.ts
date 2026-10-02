import { adminRulesContract } from "@openrift/shared/contracts/admin/rules";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminRuleVersionsQueryOptions } from "@/features/rules/lib/admin-rule-versions-queries";
import {
  ruleVersionsQueryOptions,
  rulesAtVersionQueryOptions,
} from "@/features/rules/lib/rules-queries";
import { serverCache } from "@/lib/server-cache";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

interface RuleVersionDetails {
  comments: string | null;
  label: string | null;
  documentVersion: string | null;
}

interface RuleVersionKey {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
}

type ImportRulesInput = RuleVersionKey & { content: string } & Partial<RuleVersionDetails>;

type UpdateRuleVersionInput = RuleVersionKey & RuleVersionDetails;

export function useRulesAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
  return useSuspenseQuery(rulesAtVersionQueryOptions(kind, language, version));
}

export function useRuleVersions(kind: RuleKind, language: RuleLanguage) {
  return useSuspenseQuery(ruleVersionsQueryOptions(kind, language));
}

export function useAdminRuleVersions() {
  return useSuspenseQuery(adminRuleVersionsQueryOptions());
}

const importRulesFn = createServerFn({ method: "POST" })
  .validator((input: ImportRulesInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const result = await apiOrpcClient(adminRulesContract, context.cookie).import({
      kind: data.kind,
      language: data.language,
      version: data.version,
      comments: data.comments,
      label: data.label,
      documentVersion: data.documentVersion,
      content: data.content,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules"] });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
    return result;
  });

export function useImportRules() {
  return useMutationWithInvalidation({
    mutationFn: (vars: ImportRulesInput) => importRulesFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}

const deleteRuleVersionFn = createServerFn({ method: "POST" })
  .validator((input: RuleVersionKey) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminRulesContract, context.cookie).removeVersion({
      kind: data.kind,
      language: data.language,
      version: data.version,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules"] });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
  });

export function useDeleteRuleVersion() {
  return useMutationWithInvalidation({
    mutationFn: (vars: RuleVersionKey) => deleteRuleVersionFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}

const updateRuleVersionFn = createServerFn({ method: "POST" })
  .validator((input: UpdateRuleVersionInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const result = await apiOrpcClient(adminRulesContract, context.cookie).updateVersion({
      kind: data.kind,
      language: data.language,
      version: data.version,
      comments: data.comments,
      label: data.label,
      documentVersion: data.documentVersion,
    });
    await serverCache.invalidateQueries({ queryKey: ["server-cache", "rules-versions"] });
    return result;
  });

export function useUpdateRuleVersion() {
  return useMutationWithInvalidation({
    mutationFn: (vars: UpdateRuleVersionInput) => updateRuleVersionFn({ data: vars }),
    invalidates: [["rules"], adminKeys.rules.versions],
  });
}
