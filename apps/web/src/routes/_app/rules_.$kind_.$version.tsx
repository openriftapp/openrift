import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { ruleVersionLabels } from "@/features/rules/lib/rule-version-label";
import {
  ruleKindTitle,
  ruleVersionDescription,
  VALID_RULE_KINDS,
} from "@/features/rules/lib/rules-kinds";
import {
  rulesAtVersionQueryOptions,
  ruleVersionsQueryOptions,
} from "@/features/rules/lib/rules-queries";
import { defaultRuleLanguage, rulesSearchSchema } from "@/features/rules/lib/rules-search-schema";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { getLocale } from "@/paraglide/runtime.js";

interface RulesVersionLoaderData {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  versionLabel: string;
  languages: RuleLanguage[];
}

export const Route = createFileRoute("/_app/rules_/$kind_/$version")({
  validateSearch: rulesSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q, lang: search.lang }),
  loader: async ({ params, context, location, deps }): Promise<RulesVersionLoaderData> => {
    if (!VALID_RULE_KINDS.has(params.kind as RuleKind)) {
      throw notFound();
    }
    const kind = params.kind as RuleKind;
    const english = await context.queryClient.query({
      ...ruleVersionsQueryOptions(kind, "en"),
      staleTime: "static",
    });
    const languages = english.versions.find((entry) => entry.version === params.version)
      ?.languages ?? ["en"];
    if (deps.lang === undefined || !languages.includes(deps.lang)) {
      const lang = deps.lang === undefined ? defaultRuleLanguage(languages, getLocale()) : "en";
      throw redirect({
        to: "/rules/$kind/$version",
        params: { kind, version: params.version },
        search: deps.q === undefined ? { lang } : { q: deps.q, lang },
        hash: location.hash || undefined,
        replace: true,
      });
    }
    const language = deps.lang;
    const [versions] = await Promise.all([
      language === "en"
        ? english
        : context.queryClient.query({
            ...ruleVersionsQueryOptions(kind, language),
            staleTime: "static",
          }),
      context.queryClient.query({
        ...rulesAtVersionQueryOptions(kind, language, params.version),
        staleTime: "static",
      }),
    ]);
    const versionLabel = ruleVersionLabels(versions.versions).get(params.version) ?? params.version;
    return { kind, language, version: params.version, versionLabel, languages };
  },
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
  errorComponent: RouteErrorFallback,
});
