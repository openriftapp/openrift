import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { Suspense, useState } from "react";

import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { PrintingRow } from "@/features/catalog-admin/components/printing-row";
import { PrintingToolbar } from "@/features/catalog-admin/components/printing-toolbar";
import type { PrintingFilterState } from "@/features/catalog-admin/lib/printing-filters";
import {
  DEFAULT_PRINTING_FILTERS,
  filterPrintings,
} from "@/features/catalog-admin/lib/printing-filters";
import { useEnumOrders } from "@/hooks/use-enums";
import { useMarkers } from "@/hooks/use-markers";

function PrintingList({
  detail,
  cardSlug,
  filters,
  isAdmin,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
  filters: PrintingFilterState;
  isAdmin: boolean;
}) {
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rowLabels = {
    artVariants: labels.artVariants,
    rarities: labels.rarities,
    finishes: labels.finishes,
    markers: Object.fromEntries(markersData.markers.map((marker) => [marker.slug, marker.label])),
  };

  const shown = filterPrintings(detail.printings, filters).toSorted(
    (a, b) => a.canonicalRank - b.canonicalRank,
  );

  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">No printing matches these filters.</p>;
  }

  return (
    <CardList>
      {shown.map((printing) => (
        <PrintingRow
          key={printing.id}
          printing={printing}
          detail={detail}
          cardSlug={cardSlug}
          labels={rowLabels}
          isAdmin={isAdmin}
          expanded={expandedId === printing.id}
          onToggle={() => setExpandedId(expandedId === printing.id ? null : printing.id)}
        />
      ))}
    </CardList>
  );
}

export function PrintingsTab({
  detail,
  cardSlug,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
}) {
  const { data: isAdmin } = useIsAdmin();
  const [filters, setFilters] = useState<PrintingFilterState>(DEFAULT_PRINTING_FILTERS);
  const fullAdmin = isAdmin === true;

  return (
    <div className="space-y-4">
      <PrintingToolbar
        printings={detail.printings}
        filters={filters}
        onFiltersChange={setFilters}
        cardSlug={cardSlug}
        isAdmin={fullAdmin}
      />

      {detail.printings.length === 0 ? (
        <p className="text-muted-foreground text-sm">This card has no printing yet.</p>
      ) : (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <PrintingList detail={detail} cardSlug={cardSlug} filters={filters} isAdmin={fullAdmin} />
        </Suspense>
      )}

      {!fullAdmin && (
        <p className="text-muted-foreground text-sm">
          Full admins only: adding, duplicating and deleting printings, and everything under source
          links.
        </p>
      )}

      <p className="text-muted-foreground text-sm">
        Printings proposed by a source are not listed here. They wait on Attention, and Compare
        shows them beside what the catalog already holds.
      </p>
    </div>
  );
}
