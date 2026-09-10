import type {
  AdminMarketplaceName,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { marketplaceCarriesLanguage } from "@openrift/shared/types/pricing";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { WandSparklesIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  computeProductSuggestions,
  productSuggestionKey,
  STRONG_MATCH_THRESHOLD,
} from "@/features/admin/components/suggest-mapping";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/hooks/use-unified-mappings";
import { IgnoredProductsNote } from "@/features/catalog-admin/components/ignored-products-note";
import { MarketplaceProductsTable } from "@/features/catalog-admin/components/marketplace-products-table";
import { useMarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import {
  buildCoverageLines,
  CATALOG_MARKETPLACES,
  coverageSentence,
} from "@/features/catalog-admin/lib/marketplace-coverage-line";
import {
  acceptableAssignments,
  buildMarketplaceProductGroups,
  suggestionCounts,
} from "@/features/catalog-admin/lib/marketplace-product-groups";

export function MarketplaceTab({ cardSlug }: { cardSlug: string }) {
  const { data: adminFlag, isPending: accessPending } = useIsAdmin();
  const isAdmin = adminFlag === true;
  const { data, isLoading, isError } = useQuery({
    ...unifiedMappingsForCardQueryOptions(cardSlug),
    enabled: isAdmin,
  });
  const actions = useMarketplaceActions(cardSlug);

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const acceptAllRef = useRef<() => void>(() => {});
  useHotkey("Mod+Enter", () => acceptAllRef.current(), { enabled: isAdmin && !actions.isPending });

  const group = data?.group ?? null;
  const suggestions = group ? computeProductSuggestions(group) : null;
  const productGroups =
    group && suggestions
      ? buildMarketplaceProductGroups(
          group,
          (marketplace, externalId, finish, language) =>
            suggestions.get(productSuggestionKey(marketplace, externalId, finish, language)) ?? [],
          STRONG_MATCH_THRESHOLD,
        )
      : [];
  const acceptable = acceptableAssignments(productGroups);

  useEffect(() => {
    acceptAllRef.current = () => {
      if (acceptable.assignments.length > 0) {
        actions.assign(acceptable.assignments);
      }
    };
  });

  if (accessPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isAdmin) {
    return (
      <p className="text-muted-foreground text-sm">
        Full admins only. Marketplace links are not part of card review.
      </p>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        The marketplace data could not be loaded, so this tab cannot say what is linked. Reload the
        page to try again.
      </p>
    );
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Nothing on sale for this card yet. Products appear once a price feed carries them.
        </p>
        <IgnoredProductsNote />
      </div>
    );
  }

  const printings = group.printings;
  const assignable = Object.fromEntries(
    CATALOG_MARKETPLACES.map((marketplace) => [
      marketplace,
      printings.filter((printing) => marketplaceCarriesLanguage(marketplace, printing.language)),
    ]),
  ) as Record<AdminMarketplaceName, UnifiedMappingPrintingResponse[]>;

  const counts = suggestionCounts(productGroups);
  const accepting = acceptable.assignments.length;

  return (
    <div className="space-y-4">
      <Callout className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{coverageSentence(buildCoverageLines(group), counts.total)}</p>
        {accepting > 0 && (
          <Button
            className="gap-1.5"
            disabled={actions.isPending}
            onClick={() => actions.assign(acceptable.assignments)}
          >
            <WandSparklesIcon />
            Accept {accepting} {acceptable.strength} suggestion{accepting === 1 ? "" : "s"}
            <Kbd className="bg-background/20 pointer-events-none ml-1 leading-none text-inherit opacity-60">
              Ctrl &#8629;
            </Kbd>
          </Button>
        )}
      </Callout>

      {productGroups.length === 0 ? (
        <p className="text-muted-foreground text-sm">No product for this card yet.</p>
      ) : (
        <MarketplaceProductsTable
          groups={productGroups}
          assignable={assignable}
          allCards={data?.allCards ?? []}
          actions={actions}
        />
      )}

      <IgnoredProductsNote />
    </div>
  );
}
