import type { RuleLanguage } from "@openrift/shared/types/api/rules";
import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { infractionsSearchSchema } from "@/features/rules/lib/rules-search-schema";
import { loadRulesVersion } from "@/features/rules/lib/rules-version-loader";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/rules_/$kind_/$version_/infractions")({
  validateSearch: infractionsSearchSchema,
  // No `q`: the page filters on the client, and a keystroke must not rerun the loader.
  loaderDeps: ({ search }) => ({ lang: search.lang, penalty: search.penalty }),
  loader: ({ params, context, location, deps }) =>
    loadRulesVersion({
      queryClient: context.queryClient,
      kind: params.kind,
      version: params.version,
      // The query rides along only for the language redirect.
      search: { ...infractionsSearchSchema(location.search), ...deps },
      hash: location.hash,
      view: "infractions",
    }),
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { kind, language, versionLabel, languages } = loaderData;
    const path = (lang: RuleLanguage) =>
      `/rules/${kind}/${params.version}/infractions?lang=${lang}`;
    return seoHead({
      siteUrl: getSiteUrl(),
      title: m.rules_infractions_seo_title({ version: versionLabel }, { locale: language }),
      description: m.rules_infractions_seo_description(
        { version: versionLabel },
        { locale: language },
      ),
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
  notFoundComponent: NotFoundFallback,
});
