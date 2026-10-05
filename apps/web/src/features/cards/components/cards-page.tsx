import { getRouteApi } from "@tanstack/react-router";
import { Suspense } from "react";

import { CardBrowser } from "@/features/cards/components/card-browser";
import { FirstRowPreview } from "@/features/cards/components/first-row-preview";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { seedCatalogVersion } from "@/features/cards/lib/catalog-version";
import { useHydrated } from "@/hooks/use-hydrated";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";
import { cn, PAGE_PADDING_NO_TOP } from "@/lib/utils";

const routeApi = getRouteApi("/_app/cards");

// <CardBrowser> only mounts post-hydration: rendering it server-side would
// trigger the catalog useSuspenseQuery and stage the full 310 KB catalog
// into the dehydrated per-request QueryClient.
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
  const { catalogVersion } = routeApi.useLoaderData();
  // Seed during render: the catalog query fires from useSuspenseQuery right
  // after useHydrated's own effect, before an effect here would run.
  if (globalThis.window !== undefined) {
    seedCatalogVersion(catalogVersion);
  }
  return (
    <ViewSurfaceProvider value="cards">
      <FilterSearchProvider value={search}>
        <div className={cn("flex flex-1 flex-col", PAGE_PADDING_NO_TOP)}>
          <CardBrowserShell />
        </div>
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}
