import { getRouteApi } from "@tanstack/react-router";

import { CardBrowser } from "@/features/cards/components/card-browser";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { useSearchWithDefaultLanguages } from "@/features/cards/hooks/use-search-with-default-languages";
import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";

const routeApi = getRouteApi("/_app/cards");

export function CardsPage() {
  const search = routeApi.useSearch();
  const shownSearch = useSearchWithDefaultLanguages(search);
  return (
    <ViewSurfaceProvider value="cards">
      <FilterSearchProvider value={shownSearch}>
        <CatalogLanguagesContext value={search.languages ?? null}>
          <div className={cn("flex flex-1 flex-col", PAGE_PADDING_NO_TOP)}>
            <CardBrowser />
          </div>
        </CatalogLanguagesContext>
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}
