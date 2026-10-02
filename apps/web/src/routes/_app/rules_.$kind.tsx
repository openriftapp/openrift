import type { RuleKind } from "@openrift/shared/types/api/rules";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import {
  ruleKindDescription,
  ruleKindTitle,
  VALID_RULE_KINDS,
} from "@/features/rules/lib/rules-kinds";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { defaultRuleLanguage, rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { getLocale } from "@/paraglide/runtime.js";

export const Route = createFileRoute("/_app/rules_/$kind")({
  validateSearch: rulesSearchSchema,
  // Before `head`, not after: a `head` that reads route data in between breaks
  // the builder's inference chain and the loader's `deps` collapses to `{}`.
  loaderDeps: ({ search }) => ({ q: search.q, lang: search.lang }),
  head: ({ params }) => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind)) {
      return {};
    }
    const kind = params.kind as RuleKind;
    return seoHead({
      siteUrl: getSiteUrl(),
      title: ruleKindTitle(kind),
      description: ruleKindDescription(kind),
      path: `/rules/${kind}`,
    });
  },
  loader: async ({ params, context, location, deps }) => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind)) {
      throw notFound();
    }
    const kind = params.kind as RuleKind;
    const english = await context.queryClient.query({
      ...ruleVersionsQueryOptions(kind, "en"),
      staleTime: "static",
    });
    const language =
      deps.lang !== undefined && english.languages.includes(deps.lang)
        ? deps.lang
        : defaultRuleLanguage(english.languages, getLocale());
    const versions =
      language === "en"
        ? english
        : await context.queryClient.query({
            ...ruleVersionsQueryOptions(kind, language),
            staleTime: "static",
          });
    const latest = versions.versions.at(-1);
    if (latest) {
      throw redirect({
        to: "/rules/$kind/$version",
        params: { kind, version: latest.version },
        // Carried through: /rules/core?q=might is the shareable form, and the
        // command palette's "Search rules" row produces exactly that.
        search: deps.q === undefined ? { lang: language } : { q: deps.q, lang: language },
        hash: location.hash || undefined,
        replace: true,
      });
    }
    return { kind };
  },
  errorComponent: RouteErrorFallback,
});
