import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties } from "react";

import { PAGE_HERO_EYEBROW_CLASS, PageHero } from "@/components/layout/page-hero";
import { PageToc, PageTocMobileTrigger } from "@/components/layout/page-toc";
import { PAGE_TOP_BAR_GEOMETRY } from "@/components/layout/page-top-bar";
import { SearchInput } from "@/components/search-input";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import {
  ArtVariantsSection,
  BoosterPacksSection,
  FinishesSection,
  MarkersSection,
  PrintingDetailsSection,
  RaritiesSection,
} from "@/features/rules/components/glossary-printing-sections";
import { NumberingSection, SetsSection } from "@/features/rules/components/glossary-sets-sections";
import { glossaryTocItems, GroupHeading } from "@/features/rules/components/glossary-shared";
import {
  CardTypesSection,
  DomainsSection,
  KeywordsSection,
  SymbolsSection,
} from "@/features/rules/components/glossary-vocabulary-sections";
import { KindTabs } from "@/features/rules/components/rules-toolbar";
import { KEYWORD_INFO } from "@/features/rules/lib/glossary";
import type { KeywordRow, SetEntry } from "@/features/rules/lib/glossary-content";
import { useMarkerList } from "@/hooks/use-enums";
import { useIsStuck } from "@/hooks/use-is-stuck";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
import { initQueryOptions } from "@/lib/init-queries";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const route = getRouteApi("/_app/glossary");

function buildKeywordRows(
  keywords: Record<string, { color: string; darkText?: boolean }>,
): KeywordRow[] {
  const rows: KeywordRow[] = [];
  const seen = new Set<string>();
  for (const [name, entry] of Object.entries(keywords)) {
    seen.add(name);
    rows.push({ name, color: entry.color, darkText: entry.darkText, info: KEYWORD_INFO[name] });
  }
  for (const name of Object.keys(KEYWORD_INFO)) {
    if (!seen.has(name)) {
      rows.push({ name, info: KEYWORD_INFO[name] });
    }
  }
  return rows.toSorted((a, b) => a.name.localeCompare(b.name));
}

export function GlossaryPage() {
  const { data: init } = useSuspenseQuery(initQueryOptions);
  const { data: setList } = useSuspenseQuery(publicSetListQueryOptions);
  const markers = useMarkerList();
  const { q } = route.useSearch();
  const navigate = route.useNavigate();
  const [query, setQuery] = useSearchUrlSync({
    urlValue: q ?? "",
    onCommit: (next) => {
      void navigate({
        search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
        replace: true,
        resetScroll: false,
      });
    },
  });
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const isToolbarStuck = useIsStuck(toolbarEl);
  const toolbarHeight = useMeasuredHeight(toolbarEl);

  const keywordRows = buildKeywordRows(init.keywords ?? {});

  const domains = init.enums.domains ?? [];
  const rarities = init.enums.rarities ?? [];
  const cardTypes = init.enums.cardTypes ?? [];
  const artVariants = init.enums.artVariants ?? [];
  const finishes = init.enums.finishes ?? [];
  const sets: SetEntry[] = (setList.sets ?? []).map((setEntry) => ({
    slug: setEntry.slug,
    name: setEntry.name,
    releases: setEntry.releases,
    setType: setEntry.setType,
    cardCount: setEntry.cardCount,
  }));

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <div className="mb-2">
              <KindTabs kind="glossary" />
            </div>
            <span className={PAGE_HERO_EYEBROW_CLASS}>{m.rules_hero_eyebrow()}</span>
          </>
        }
        title={m.glossary_title()}
        lead={m.glossary_intro()}
      />
      <div className={cn(PAGE_WIDTH.capped, "pt-3", PAGE_PADDING_NO_TOP)}>
        <div
          ref={setToolbarEl}
          className={cn(
            PAGE_TOP_BAR_GEOMETRY,
            isToolbarStuck && STICKY_SURFACE,
            "px-safe mx-safe-neg z-20 mb-4 flex items-center gap-2",
          )}
        >
          <PageTocMobileTrigger
            items={glossaryTocItems()}
            className="sm:w-auto sm:gap-1.5 sm:px-2.5"
            labelClassName="hidden sm:inline"
          />
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={m.glossary_search_placeholder()}
            aria-label={m.glossary_search_placeholder()}
            className="min-w-0 flex-1"
          />
        </div>

        <div
          className="flex gap-6"
          style={
            toolbarHeight > 0
              ? ({
                  "--sticky-top": `calc(var(--header-height) + ${toolbarHeight}px + 1rem)`,
                } as CSSProperties)
              : undefined
          }
        >
          <PageToc items={glossaryTocItems()} />
          <div className="min-w-0 flex-1 space-y-12">
            <section className="space-y-10">
              <GroupHeading id="game-vocabulary" title={m.glossary_group_vocabulary()} />
              <DomainsSection domains={domains} query={query} />
              <CardTypesSection types={cardTypes} query={query} />
              <KeywordsSection keywords={keywordRows} query={query} />
              <SymbolsSection query={query} />
            </section>
            <section className="space-y-10">
              <GroupHeading id="printing-variants" title={m.glossary_group_printing_variants()} />
              <RaritiesSection rarities={rarities} query={query} />
              <BoosterPacksSection query={query} />
              <ArtVariantsSection artVariants={artVariants} query={query} />
              <FinishesSection finishes={finishes} query={query} />
              <MarkersSection markers={markers} query={query} />
              <PrintingDetailsSection query={query} />
            </section>
            <section className="space-y-10">
              <GroupHeading id="sets-and-numbering" title={m.glossary_group_sets_numbering()} />
              <SetsSection sets={sets} query={query} />
              <NumberingSection query={query} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
