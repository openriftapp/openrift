import { getRouteApi, Link } from "@tanstack/react-router";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";

import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { AdminCardsTable, ALL_SETS } from "@/features/admin/components/admin-cards-table";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardList } from "@/features/admin/hooks/use-admin-card-queries";
import { useUnifiedMappingsWhen } from "@/features/admin/hooks/use-unified-mappings";
import { filterCardsBySet } from "@/features/admin/lib/admin-cards-search";
import { useSets } from "@/features/cards/hooks/use-sets";
import { buildPriceAssignBucketsBySlug } from "@/features/cards/lib/marketplace-coverage";

const routeApi = getRouteApi("/_app/_authenticated/admin/cards");

export function AdminCardListPage() {
  const { data } = useAdminCardList();
  const { data: access } = useAdminAccess();
  // card-review grant holders share this page with full admins; only card
  // creation, marketplace data, and unmatched products are admin-only.
  const isAdmin = access?.isAdmin === true;
  const { data: unified } = useUnifiedMappingsWhen(isAdmin);
  const { data: setsData } = useSets();
  const setSlug = routeApi.useSearch({ select: (s) => s.set });

  const setOptions = [
    { value: ALL_SETS, label: "All sets" },
    ...setsData.sets
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ value: s.slug, label: s.name })),
  ];
  if (setSlug && !setOptions.some((o) => o.value === setSlug)) {
    setOptions.push({ value: setSlug, label: setSlug });
  }

  // Each row carries the set slugs of both accepted and candidate printings,
  // so the set filter narrows drafts as well as live cards.
  const cards = filterCardsBySet(data, setSlug);
  const unmatchedCount = unified
    ? unified.unmatchedProducts.tcgplayer.length +
      unified.unmatchedProducts.cardmarket.length +
      unified.unmatchedProducts.cardtrader.length
    : 0;

  return (
    <>
      <AdminPageTopBar
        title="Cards"
        actions={
          isAdmin ? (
            <>
              <PageTopBarButton render={<Link to="/admin/unmatched" />}>
                <AlertTriangleIcon />
                Unmatched {unmatchedCount}
              </PageTopBarButton>
              <PageTopBarPrimaryButton render={<Link to="/admin/cards/create" />}>
                <PlusIcon />
                New card
              </PageTopBarPrimaryButton>
            </>
          ) : undefined
        }
      />

      <div className="pt-3">
        <AdminCardsTable
          data={cards}
          assignBucketsBySlug={buildPriceAssignBucketsBySlug(unified?.groups ?? [])}
          setOptions={setOptions}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
