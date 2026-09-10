import type { CatalogCardRow } from "@openrift/shared/contracts/admin/catalog-review";
import { getRouteApi, Link } from "@tanstack/react-router";
import { LayersIcon, PlusIcon, UploadIcon } from "lucide-react";

import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { useUnifiedMappingsWhen } from "@/features/admin/hooks/use-unified-mappings";
import { useSets } from "@/features/cards/hooks/use-sets";
import {
  ALL_ASSIGNABLE_SCOPE,
  buildPriceAssignBucketsBySlug,
  scopeLabel,
} from "@/features/cards/lib/marketplace-coverage";
import { CatalogCardsList } from "@/features/catalog-admin/components/catalog-cards-list";
import { CatalogCardsToolbar } from "@/features/catalog-admin/components/catalog-cards-toolbar";
import { useCatalogCards } from "@/features/catalog-admin/hooks/use-catalog-list";
import type { ScopeOption } from "@/features/catalog-admin/lib/catalog-card-list";
import {
  cardsListParams,
  cardsListSearch,
  scopeCardCounts,
  scopeKeysInOrder,
  segmentCounts,
  selectCatalogCards,
  unlinkedProductCount,
  visibleIssues,
} from "@/features/catalog-admin/lib/catalog-card-list";

const routeApi = getRouteApi("/_app/_authenticated/admin/catalog/cards/");

export function CatalogCardsPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data, isLoading } = useCatalogCards();
  const { data: setsData } = useSets();
  const { data: isAdmin } = useIsAdmin();
  const { data: mappings } = useUnifiedMappingsWhen(isAdmin === true);

  const canSeeProducts = isAdmin === true;
  const params = cardsListParams(search, canSeeProducts);
  const listSearch = cardsListSearch(params);

  const bucketsBySlug = buildPriceAssignBucketsBySlug(mappings?.groups ?? []);
  const bucketsFor = (cardSlug: string | null) =>
    cardSlug === null ? undefined : bucketsBySlug.get(cardSlug);

  const rows = data?.rows ?? [];
  const visible = selectCatalogCards(rows, { ...params, buckets: bucketsFor });
  const counts = segmentCounts(rows, params);

  const scopedRows = selectCatalogCards(rows, {
    segment: params.segment,
    scope: ALL_ASSIGNABLE_SCOPE,
    set: params.set,
    q: params.q,
  });
  const bucketCounts = scopeCardCounts(scopedRows, bucketsFor);
  const umbrellaCount = scopedRows.filter(
    (row) => unlinkedProductCount(bucketsFor(row.cardSlug), ALL_ASSIGNABLE_SCOPE) > 0,
  ).length;
  const scopeOptions: ScopeOption[] = [
    { value: ALL_ASSIGNABLE_SCOPE, label: scopeLabel(ALL_ASSIGNABLE_SCOPE), count: umbrellaCount },
    ...scopeKeysInOrder(bucketCounts).map((key) => ({
      value: key,
      label: scopeLabel(key),
      count: bucketCounts.get(key) ?? 0,
    })),
  ];

  const anyUnlinked = [...bucketsBySlug.values()].some((buckets) =>
    buckets.some((bucket) => bucket.unbound > 0),
  );
  const issues = visibleIssues(canSeeProducts && anyUnlinked);

  function unlinkedFor(row: CatalogCardRow): number {
    return unlinkedProductCount(bucketsFor(row.cardSlug), params.scope);
  }

  return (
    <>
      <AdminPageTopBar
        title="Cards"
        actions={
          canSeeProducts ? (
            <>
              <PageTopBarButton render={<Link to="/admin/catalog/sources" />}>
                <UploadIcon />
                Upload source
              </PageTopBarButton>
              <PageTopBarPrimaryButton render={<Link to="/admin/cards/create" />}>
                <PlusIcon />
                New card
              </PageTopBarPrimaryButton>
            </>
          ) : undefined
        }
      />

      <div className="space-y-4 pt-3">
        <CatalogCardsToolbar
          state={params}
          counts={counts}
          sets={setsData.sets}
          scopeOptions={scopeOptions}
          issues={issues}
          visibleCount={visible.length}
          handlers={{
            onSegment: (next) => {
              void navigate({
                search: (prev) => ({ ...prev, segment: next === "all" ? undefined : next }),
              });
            },
            onIssue: (next) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  issue: next ?? undefined,
                  scope: next === "unlinked-products" ? prev.scope : undefined,
                }),
              });
            },
            onScope: (next) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  scope: next === ALL_ASSIGNABLE_SCOPE ? undefined : next,
                }),
              });
            },
            onSet: (next) => {
              void navigate({ search: (prev) => ({ ...prev, set: next ?? undefined }) });
            },
            onQuery: (next) => {
              void navigate({
                replace: true,
                search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
              });
            },
          }}
        />

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : visible.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayersIcon />
              </EmptyMedia>
              <EmptyTitle>No cards match</EmptyTitle>
              <EmptyDescription>
                Clear the search or switch to All to see the whole catalogue.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <CatalogCardsList rows={visible} unlinkedFor={unlinkedFor} listSearch={listSearch} />
        )}
      </div>
    </>
  );
}
