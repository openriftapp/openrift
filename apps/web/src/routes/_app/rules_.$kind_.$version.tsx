import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { createFileRoute } from "@tanstack/react-router";

import {
  ruleKindTitle,
  ruleVersionDescription,
  VALID_RULE_KINDS,
} from "@/features/rules/lib/rules-kinds";
import { rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";
import { loadRulesVersion } from "@/features/rules/lib/rules-version-loader";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/rules_/$kind_/$version")({
  validateSearch: rulesSearchSchema,
  // No `q`: the page filters on the client, and a keystroke must not rerun the loader.
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: ({ params, context, location, deps }) =>
    loadRulesVersion({
      queryClient: context.queryClient,
      kind: params.kind,
      version: params.version,
      // The query rides along only for the language redirect.
      search: { ...rulesSearchSchema(location.search), ...deps },
      hash: location.hash,
      view: "document",
    }),
  head: ({ loaderData, params }) => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind) || loaderData === undefined) {
      return {};
    }
    const { kind, language, versionLabel, languages } = loaderData;
    const path = (lang: RuleLanguage) => `/rules/${kind}/${params.version}?lang=${lang}`;
    return seoHead({
      siteUrl: getSiteUrl(),
      title: `${ruleKindTitle(kind, language)} ${versionLabel}`,
      description: ruleVersionDescription(kind, versionLabel, language),
      path: path(language),
      alternates:
        languages.length > 1
          ? [
              ...languages.map((lang) => ({ hrefLang: lang, path: path(lang) })),
              { hrefLang: "x-default", path: path("en") },
            ]
          : undefined,
    });
  },
});
