import { filterCards } from "@openrift/shared/filters";
import { getAvailableFilters } from "@openrift/shared/filters-available";
import { sortCards } from "@openrift/shared/filters-sort";
import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { sideKey, countPrintings } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { SortDirection, SortOption } from "@openrift/shared/types/search";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";

import { PageHero } from "@/components/layout/page-hero";
import { PageToc, PageTocProvider } from "@/components/layout/page-toc";
import { TextLink } from "@/components/ui/text-link";
import { Toggle } from "@/components/ui/toggle";
import {
  BrowserToolbar,
  CardBrowserFilterProvider,
} from "@/features/cards/components/card-browser-filter-scaffold";
import { CardBrowserLayout } from "@/features/cards/components/card-browser-layout";
import { PromoSectionsContent } from "@/features/cards/components/promo-sections-content";
import {
  PromosLanguagePanel,
  PromosLanguageSelect,
} from "@/features/cards/components/promos-language-picker";
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import { SelectionDetailPane } from "@/features/cards/components/selection-detail-pane";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { useCardSearchContext } from "@/features/cards/hooks/use-card-search-context";
import { useCardThumbnailDisplayWith } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCatalogOnDemand } from "@/features/cards/hooks/use-cards";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { usePricesOnDemand } from "@/features/cards/hooks/use-prices";
import { useSearchAndCloseDetail } from "@/features/cards/hooks/use-search-and-close-detail";
import { buildGroups } from "@/features/cards/lib/card-groups";
import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import { groupByOptionsFor } from "@/features/cards/lib/group-by-field";
import {
  buildPromoTreeFromMatches,
  withCatalogPrintedNames,
} from "@/features/cards/lib/promo-filters";
import {
  asPromoGrouping,
  PROMO_GROUPINGS,
  toPromoSections,
} from "@/features/cards/lib/promo-groupings";
import type { FlatSectionKind, PromoTocItem } from "@/features/cards/lib/promo-sections";
import {
  buildFlatRenderItems,
  collectChannelTocItems,
  collectFlatSectionTocItems,
  flattenChannelSections,
} from "@/features/cards/lib/promo-sections";
import { publicPromoListQueryOptions } from "@/features/cards/lib/public-promos-queries";
import { findSearchAlternatives } from "@/features/cards/lib/search-alternative";
import { useOwnedCount } from "@/features/collections/hooks/use-owned-count";
import { applyOwnedBucketFilter } from "@/features/collections/lib/owned-bucket";
import { useDisplayLanguages } from "@/hooks/use-display-languages";
import { useEnumOrders, useLanguageList } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useSession } from "@/hooks/use-session";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

const routeApi = getRouteApi("/_app/promos_/$language");

const PROMOS_BASE_HIDDEN_SECTIONS: ReadonlySet<string> = new Set(["promo"]);

export function PromosPage() {
  const search = routeApi.useSearch();
  const { language } = routeApi.useParams();
  return (
    <ViewSurfaceProvider value="promos">
      <FilterSearchProvider value={{ ...search, view: "printings" }}>
        <CatalogLanguagesContext value={[...(search.languages ?? []), language]}>
          <PageTocProvider>
            <PromosBrowser />
          </PageTocProvider>
        </CatalogLanguagesContext>
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}

function PromosBrowser() {
  const { language: activeLanguage } = routeApi.useParams();
  const { data } = useSuspenseQuery(publicPromoListQueryOptions(activeLanguage));
  const location = useLocation();
  const showImages = useDisplayStore((s) => s.showImages);
  const languageOrder = useDisplayLanguages();
  const languageList = useLanguageList();
  const languageLabelMap = new Map(languageList.map((l) => [l.code, l.name]));
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const cardsShowCounts = useDisplayStore((s) => s.cardsShowCounts);
  const toggleCardsShowCounts = useDisplayStore((s) => s.toggleCardsShowCounts);
  const showOwned = isLoggedIn && cardsShowCounts;
  const { filters, ranges, filterState, groupDir, hasActiveFilters } = useFilterValues();
  const ownedFilterActive = filters.ownedFilter.length > 0;
  const fetchOwned = isLoggedIn && (showOwned || ownedFilterActive);
  const hydrated = useHydrated();
  // Read after hydration so the price map stays out of the server-rendered HTML.
  const display = useCardThumbnailDisplayWith(usePricesOnDemand(hydrated) ?? EMPTY_PRICE_LOOKUP);
  const { data: ownedCountByPrinting } = useOwnedCount(fetchOwned);
  const ownedCounts = showOwned ? ownedCountByPrinting : undefined;
  const togglePromoOwned = () => {
    toggleCardsShowCounts();
  };
  const { orders: enumOrders, labels: enumLabels } = useEnumOrders();
  const { setSearch } = useFilterActions();
  const isMobile = useIsMobile();
  const groupOptions = groupByOptionsFor(PROMO_GROUPINGS);

  const presentLanguageSet = new Set(data.languages);
  const presentLanguages = [
    ...languageOrder.filter((lang) => presentLanguageSet.has(lang)),
    ...[...presentLanguageSet].filter((lang) => !languageOrder.includes(lang)).toSorted(),
  ];

  const viewMode = useDisplayStore((s) => s.displayMode);

  const promoSets = data.sets;
  const setSlugToName = new Map(promoSets.map((s) => [s.slug, s.name] as const));
  const setDisplayLabel = (slug: string) => setSlugToName.get(slug) ?? slug;

  const activePrintings = data.printings;

  // Keyed off price presence, not an EN assumption: Cardmarket/TCGplayer are
  // EN-only with no language field, but CardTrader prices per-language variants.
  const priceFilterEnabled = activePrintings.some(
    (p) => display.prices.get(p.printingId, display.favoriteMarketplace) !== undefined,
  );

  const availableFilters = getAvailableFilters(activePrintings, {
    orders: enumOrders,
    sets: promoSets,
    channels: data.channels,
    getPrice: (p) => display.prices.get(p.printingId, display.favoriteMarketplace),
  });

  const sortBy = filterState.sort as SortOption;
  const sortDir = filterState.sortDir as SortDirection;
  const sortPrintings = (printings: Printing[]) =>
    sortCards(printings, sortBy, {
      sortDir,
      sets: promoSets,
      rarityOrder: enumOrders.rarities,
      getPrice: (p) => display.prices.get(p.printingId, display.favoriteMarketplace),
    });
  const cardFilters = {
    ...filters,
    languages: [activeLanguage],
    price: priceFilterEnabled ? ranges.price : { min: null, max: null },
  };
  const pageSearchContext = useCardSearchContext({
    getPrice: (p) => display.prices.get(p.printingId, display.favoriteMarketplace),
    priceLookup: display.prices,
    getOwnedCount: (p) => ownedCountByPrinting?.[p.printingId],
  });
  const { catalog } = useCatalogOnDemand(hydrated && cardFilters.search.trim() !== "");
  const searchContext = withCatalogPrintedNames(pageSearchContext, catalog?.allPrintings);
  const matchPrintings = (search: string) => {
    const matches = filterCards(activePrintings, { ...cardFilters, search }, searchContext);
    return !ownedFilterActive || !isLoggedIn || !ownedCountByPrinting
      ? matches
      : applyOwnedBucketFilter(matches, filters.ownedFilter, ownedCountByPrinting);
  };
  const matchedPrintings = matchPrintings(cardFilters.search);
  const searchAlternatives = findSearchAlternatives(
    cardFilters.search,
    matchedPrintings,
    matchPrintings,
  );
  const grouping = asPromoGrouping(filterState.groupBy);

  const selectionItems: CardViewerItem[] = matchedPrintings.map((printing) => ({
    id: sideKey(printing),
    printing,
  }));

  // The channel tree reverses its own top-level order here; every other axis
  // reverses inside buildGroups instead.
  const channelTree = buildPromoTreeFromMatches(matchedPrintings, data.channels);
  const orderedChannelTree =
    grouping === "channel" ? (groupDir === "desc" ? channelTree.toReversed() : channelTree) : [];
  const flatKind: FlatSectionKind | null = grouping === "channel" ? null : grouping;
  const flatSections =
    flatKind === null
      ? undefined
      : toPromoSections(
          buildGroups(selectionItems, flatKind, promoSets, groupDir, enumOrders, enumLabels),
        );

  const activePrefix = `lang-${activeLanguage}`;

  const channelRenderItems =
    grouping === "channel" ? flattenChannelSections(orderedChannelTree, activePrefix) : [];
  const flatRenderItems =
    flatSections && flatKind ? buildFlatRenderItems(flatSections, activePrefix, flatKind) : [];

  const hiddenFilterSections = priceFilterEnabled
    ? PROMOS_BASE_HIDDEN_SECTIONS
    : new Set([...PROMOS_BASE_HIDDEN_SECTIONS, "price"]);
  const hiddenWithOwned = isLoggedIn
    ? hiddenFilterSections
    : new Set([...hiddenFilterSections, "owned"]);

  const hasLanguageChoice = presentLanguages.length > 1;

  const tocItems: PromoTocItem[] = [];
  if (grouping === "channel") {
    collectChannelTocItems(orderedChannelTree, activePrefix, 0, tocItems);
  } else if (flatSections && flatKind) {
    tocItems.push(...collectFlatSectionTocItems(flatSections, activePrefix, flatKind));
  }

  const hasContent = channelRenderItems.length > 0 || flatRenderItems.length > 0;

  // TanStack Router navigations land before the lazy route's content is in the
  // DOM, so the native browser scroll-to-hash misses the target; re-run manually.
  useScopeEffect(`${activeLanguage} ${location.hash}`, () => {
    if (!location.hash) {
      return;
    }
    // oxlint-disable-next-line unicorn/prefer-query-selector -- section ids may start with a digit after the "ch-" prefix; getElementById avoids CSS-escape gymnastics.
    const element = document.getElementById(location.hash);
    if (element) {
      element.scrollIntoView({ behavior: "auto", block: "start" });
    }
  });

  const printingsByCardId = Map.groupBy(activePrintings, (printing) => printing.cardId);

  const handleCardClick = (printing: Printing) => {
    useSelectionStore.getState().selectCard(printing, selectionItems, "printing");
  };

  const handleSearchAndClose = useSearchAndCloseDetail(setSearch);

  return (
    <>
      <PageHero
        width="full"
        title={m.promos_title()}
        lead={
          <>
            {m.promos_hero_lead()} {m.promos_hero_missing()}{" "}
            <TextLink variant="inherit" render={<Link to="/contribute" />}>
              {m.promos_suggest_one()}
            </TextLink>
            .
          </>
        }
        aside={
          hasLanguageChoice ? (
            <PromosLanguagePanel
              activeLanguage={activeLanguage}
              counts={data.languageCounts}
              languageLabelMap={languageLabelMap}
            />
          ) : undefined
        }
      >
        {hasLanguageChoice && (
          <PromosLanguageSelect
            activeLanguage={activeLanguage}
            presentLanguages={presentLanguages}
            languageLabelMap={languageLabelMap}
            className="mt-3 md:hidden"
          />
        )}
      </PageHero>
      <div className={cn(PAGE_PADDING_NO_TOP, "pt-3")}>
        <CardBrowserFilterProvider
          searchAlternatives={searchAlternatives}
          availableFilters={availableFilters}
          setDisplayLabel={setDisplayLabel}
          hiddenSections={hiddenWithOwned}
        >
          <CardBrowserLayout
            toolbar={
              <BrowserToolbar
                totalCards={countPrintings(activePrintings)}
                filteredCount={countPrintings(matchedPrintings)}
                mobileDoneLabel={
                  hasActiveFilters
                    ? m.promos_show_count({ count: countPrintings(matchedPrintings) })
                    : undefined
                }
                hideViewToggle
                groupByOptions={groupOptions}
                groupByValue={grouping}
                extras={
                  isLoggedIn ? (
                    <Toggle
                      variant="control"
                      pressed={showOwned}
                      onPressedChange={togglePromoOwned}
                      aria-label={showOwned ? m.promos_hide_owned() : m.promos_show_owned()}
                      title={showOwned ? m.promos_hide_owned() : m.promos_show_owned()}
                    >
                      <PackageIcon className="size-4" />
                      <span className="hidden sm:inline">{m.cards_grid_owned_count_label()}</span>
                    </Toggle>
                  ) : null
                }
              />
            }
            leftPane={<PageToc items={tocItems} className="lg:w-52" />}
            rightPane={
              isMobile ? undefined : (
                <SelectionDetailPane
                  items={selectionItems}
                  printingsByCardId={printingsByCardId}
                  showImages={showImages}
                  onSearchAndClose={handleSearchAndClose}
                />
              )
            }
            gridSlot={
              <PromoSectionsContent
                grouping={grouping}
                channelRenderItems={channelRenderItems}
                flatRenderItems={flatRenderItems}
                hasContent={hasContent}
                hasActiveFilters={hasActiveFilters}
                viewMode={viewMode}
                showImages={showImages}
                display={display}
                ownedCounts={ownedCounts}
                onCardClick={handleCardClick}
                sortPrintings={sortPrintings}
                setNameBySlug={setSlugToName}
              />
            }
          >
            <SelectionDetailOverlays
              items={selectionItems}
              printingsByCardId={printingsByCardId}
              showImages={showImages}
              onSearchAndClose={handleSearchAndClose}
            />
          </CardBrowserLayout>
        </CardBrowserFilterProvider>
      </div>
    </>
  );
}
