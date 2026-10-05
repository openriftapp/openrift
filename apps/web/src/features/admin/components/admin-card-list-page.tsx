import type { PriceAssignBucket } from "@openrift/shared/price-assign-buckets";
import { getRouteApi, Link } from "@tanstack/react-router";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { AdminCardsTable, ALL_SETS } from "@/features/admin/components/admin-cards-table";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardList } from "@/features/admin/hooks/use-admin-card-queries";
import { useUnifiedMappingsSummaryWhen } from "@/features/admin/hooks/use-unified-mappings";
import { filterCardsBySet } from "@/features/admin/lib/admin-cards-search";
import { useSets } from "@/features/cards/hooks/use-sets";

const routeApi = getRouteApi("/_app/_authenticated/admin/cards");

const EMPTY_BUCKETS = new Map<string, PriceAssignBucket[]>();

export function AdminCardListPage() {
  const { data } = useAdminCardList();
  const { data: access } = useAdminAccess();
  // card-review grant holders share this page with full admins; only card
  // creation, marketplace data, and unmatched products are admin-only.
  const isAdmin = access?.isAdmin === true;
  const { data: summary } = useUnifiedMappingsSummaryWhen(isAdmin);
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
  const unmatchedCount = summary?.unmatchedCount ?? 0;

  return (
    <>
      <AdminPageTopBar
        title="Cards"
        actions={
          isAdmin ? (
            <>
              <Link to="/admin/unmatched" className={buttonVariants({ variant: "ghost" })}>
                <AlertTriangleIcon />
                Unmatched {unmatchedCount}
              </Link>
              <Link to="/admin/cards/create" className={buttonVariants()}>
                <PlusIcon />
                New card
              </Link>
            </>
          ) : undefined
        }
      />

      <AdminCardsTable
        data={cards}
        assignBucketsBySlug={summary?.assignBucketsBySlug ?? EMPTY_BUCKETS}
        setOptions={setOptions}
        isAdmin={isAdmin}
      />
    </>
  );
}
