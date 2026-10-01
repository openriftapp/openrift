import type { RuleKind } from "@openrift/shared/types/api/rules";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { ruleVersionLabels } from "@/features/rules/lib/rule-version-label";
import { ruleKindTitle, VALID_RULE_KINDS } from "@/features/rules/lib/rules-kinds";
import {
  rulesAtVersionQueryOptions,
  ruleVersionsQueryOptions,
} from "@/features/rules/lib/rules-queries";
import { rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/rules_/$kind_/$version")({
  validateSearch: rulesSearchSchema,
  loader: async ({
    params,
    context,
  }): Promise<{ kind: RuleKind; version: string; versionLabel: string }> => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind)) {
      throw notFound();
    }
    const kind = params.kind as RuleKind;
    const [versions] = await Promise.all([
      context.queryClient.query({ ...ruleVersionsQueryOptions(kind), staleTime: "static" }),
      context.queryClient.query({
        ...rulesAtVersionQueryOptions(kind, params.version),
        staleTime: "static",
      }),
    ]);
    const versionLabel = ruleVersionLabels(versions.versions).get(params.version) ?? params.version;
    return { kind, version: params.version, versionLabel };
  },
  head: ({ loaderData, params }) => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind)) {
      return {};
    }
    const kind = params.kind as RuleKind;
    const versionLabel = loaderData?.versionLabel ?? params.version;
    return seoHead({
      siteUrl: getSiteUrl(),
      title: `${ruleKindTitle(kind)} ${versionLabel}`,
      description:
        kind === "tournament"
          ? `Riftbound tournament rules, version ${versionLabel}.`
          : `Riftbound core game rules, version ${versionLabel}.`,
      path: `/rules/${kind}/${params.version}`,
    });
  },
  errorComponent: RouteErrorFallback,
});
