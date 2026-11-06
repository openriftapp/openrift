import type { PromosListResponse } from "@openrift/shared/types/api/catalog";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";

import { SectionHeading } from "@/components/ui/section-heading";
import { SimpleSelect } from "@/components/ui/simple-select";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/promos_/$language");

type LanguageCount = PromosListResponse["languageCounts"][number];

export function PromosLanguagePanel({
  activeLanguage,
  counts,
  languageLabelMap,
}: {
  activeLanguage: string;
  counts: readonly LanguageCount[];
  languageLabelMap: Map<string, string>;
}) {
  const currentSearch = routeApi.useSearch();
  return (
    <nav
      aria-label={m.promos_languages_heading()}
      className="bg-card/80 hidden w-80 shrink-0 flex-col gap-1 rounded-lg border p-4 shadow-xl md:flex"
    >
      <SectionHeading className="mb-1">{m.promos_languages_heading()}</SectionHeading>
      {counts.map((count) => {
        const active = count.language === activeLanguage;
        return (
          <Link
            key={count.language}
            to="/promos/$language"
            params={{ language: count.language }}
            search={currentSearch}
            hash=""
            aria-current={active ? "page" : undefined}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2.5 py-2",
              active && "bg-muted",
            )}
          >
            <span className="min-w-0 font-semibold">
              {languageLabelMap.get(count.language) ?? count.language}
            </span>
            <span className="text-muted-foreground shrink-0 text-sm whitespace-nowrap tabular-nums">
              {m.common_printings({ count: count.printingCount })}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PromosLanguageSelect({
  activeLanguage,
  presentLanguages,
  languageLabelMap,
  className,
}: {
  activeLanguage: string;
  presentLanguages: string[];
  languageLabelMap: Map<string, string>;
  className?: string;
}) {
  const navigate = useNavigate();
  const currentSearch = routeApi.useSearch();
  const languageItems = presentLanguages.map((code) => ({
    value: code,
    label: languageLabelMap.get(code) ?? code,
  }));

  function handleLanguageChange(next: string) {
    if (next === activeLanguage) {
      return;
    }
    void navigate({
      to: "/promos/$language",
      params: { language: next },
      search: currentSearch,
      hash: "",
    });
  }

  return (
    <SimpleSelect
      items={languageItems}
      value={activeLanguage}
      onChange={handleLanguageChange}
      label={m.promos_language_aria()}
      className={className}
    />
  );
}
