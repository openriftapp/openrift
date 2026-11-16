import { hasInfractions } from "@openrift/shared/rules-infractions";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";

import { ruleVersionLabels } from "@/features/rules/lib/rule-version-label";
import { VALID_RULE_KINDS } from "@/features/rules/lib/rules-kinds";
import {
  rulesAtVersionQueryOptions,
  ruleVersionsQueryOptions,
} from "@/features/rules/lib/rules-queries";
import { defaultRuleLanguage } from "@/features/rules/lib/rules-search-schema";
import type { InfractionsSearch } from "@/features/rules/lib/rules-search-schema";
import { getLocale } from "@/paraglide/runtime.js";

export type RulesView = "document" | "infractions";

interface RulesVersionLoaderData {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  versionLabel: string;
  languages: RuleLanguage[];
}

export async function loadRulesVersion({
  queryClient,
  kind: kindParam,
  version,
  search,
  hash,
  view,
}: {
  queryClient: QueryClient;
  kind: string;
  version: string;
  search: InfractionsSearch;
  hash: string;
  view: RulesView;
}): Promise<RulesVersionLoaderData> {
  if (!VALID_RULE_KINDS.has(kindParam as RuleKind)) {
    throw notFound();
  }
  const kind = kindParam as RuleKind;
  const { lang } = search;
  if (view === "infractions" && kind !== "tournament") {
    throw notFound();
  }
  const english = await queryClient.query({
    ...ruleVersionsQueryOptions(kind, "en"),
    staleTime: "static",
  });
  const languages = english.versions.find((entry) => entry.version === version)?.languages ?? [
    "en",
  ];
  if (lang === undefined || !languages.includes(lang)) {
    const nextLang = lang === undefined ? defaultRuleLanguage(languages, getLocale()) : "en";
    throw redirect({
      to: view === "infractions" ? "/rules/$kind/$version/infractions" : "/rules/$kind/$version",
      params: { kind, version },
      search: { ...search, lang: nextLang },
      hash: hash || undefined,
      replace: true,
    });
  }
  const [versions, rules] = await Promise.all([
    lang === "en"
      ? english
      : queryClient.query({ ...ruleVersionsQueryOptions(kind, lang), staleTime: "static" }),
    queryClient.query({ ...rulesAtVersionQueryOptions(kind, lang, version), staleTime: "static" }),
  ]);
  if (view === "infractions" && !hasInfractions(rules.rules)) {
    throw notFound();
  }
  const versionLabel = ruleVersionLabels(versions.versions).get(version) ?? version;
  return { kind, language: lang, version, versionLabel, languages };
}
