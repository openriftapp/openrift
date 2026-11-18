import { getRouteApi } from "@tanstack/react-router";
import { Suspense } from "react";

import { CardBrowser } from "@/features/cards/components/card-browser";
import { FirstRowPreview } from "@/features/cards/components/first-row-preview";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import { useHydrated } from "@/hooks/use-hydrated";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";

const routeApi = getRouteApi("/_app/cards");

/**
 * Mounts CardBrowser only after hydration: on the server its useSuspenseQuery would stage
 * the full catalog into the dehydrated per-request QueryClient.
 */
function CardBrowserShell() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <FirstRowPreview />;
  }
  return (
    <Suspense fallback={<FirstRowPreview />}>
      <CardBrowser />
    </Suspense>
  );
}

export function CardsPage() {
  const search = routeApi.useSearch();
  return (
    <ViewSurfaceProvider value="cards">
      <FilterSearchProvider value={search}>
        <CatalogLanguagesContext value={search.languages ?? null}>
          <div className={cn("flex flex-1 flex-col", PAGE_PADDING_NO_TOP)}>
            <CardBrowserShell />
          </div>
        </CatalogLanguagesContext>
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}
