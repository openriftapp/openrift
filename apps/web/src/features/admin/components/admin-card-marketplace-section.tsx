import { computeProductSuggestions } from "@openrift/shared/marketplace-suggestions";
import { pluralize } from "@openrift/shared/strings";
import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { IgnoredProductsNote } from "@/features/admin/components/ignored-products-note";
import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAssignToCardByMarketplace,
  useIgnoreProductsByMarketplace,
  useIgnoreVariantsByMarketplace,
  useOptimisticSaveMappingsByMarketplace,
  useUnassignFromCardByMarketplace,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { runReportedMutation } from "@/lib/run-reported-mutation";

import type { MarketplaceHandlers } from "./marketplace-product-entries";
import { collectSuggestedMappings } from "./marketplace-product-entries";
import { MarketplaceProductsTable } from "./marketplace-products-table";
import { PrintingPairNamesContext } from "./printing-pair-names";

export function AdminCardMarketplaceSection({
  cardSlug,
  pairNames,
  onOpenPrinting,
}: {
  cardSlug: string;
  pairNames?: ReadonlyMap<string, string>;
  onOpenPrinting?: (printingId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(unifiedMappingsForCardQueryOptions(cardSlug));

  // Refreshes both the per-card cache this page reads and the corpus-wide
  // cache (coverage badges, unmatched products on /admin/cards) so they can't disagree.
  const refreshAfter = async (run: () => Promise<unknown>) => {
    if (await runReportedMutation(run)) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardSlug) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.unifiedMappings.all }),
      ]);
    }
  };

  const saveMappings = useOptimisticSaveMappingsByMarketplace(cardSlug);

  const applyAssignments =
    (marketplace: AdminMarketplaceName) =>
    async (mappings: PrintingAssignment[]): Promise<void> => {
      if (mappings.length > 0) {
        await runReportedMutation(() => saveMappings[marketplace].mutateAsync(mappings));
      }
    };

  const assignToPrinting =
    (marketplace: AdminMarketplaceName) =>
    (eid: number, finish: string, language: string | null, pid: string) =>
      applyAssignments(marketplace)([{ externalId: eid, finish, language, printingId: pid }]);

  const ignoreVariants = useIgnoreVariantsByMarketplace();
  const ignoreProducts = useIgnoreProductsByMarketplace();
  const assignToCards = useAssignToCardByMarketplace();
  const unassigns = useUnassignFromCardByMarketplace();
  const unmapPrinting = useUnmapMarketplacePrinting([
    adminKeys.cards.detail(cardSlug),
    adminKeys.unifiedMappings.all,
  ]);

  const isSaving = ALL_MARKETPLACES.some((marketplace) => saveMappings[marketplace].isPending);
  const acceptAll = () => {
    const group = data?.group;
    if (!group) {
      return;
    }
    const { strong, weak } = collectSuggestedMappings(group, computeProductSuggestions(group));
    // Strong wins when both are present, so Ctrl+Enter never accepts a
    // low-confidence match while a strong one is still on the page.
    const totalStrong = ALL_MARKETPLACES.reduce((sum, mp) => sum + strong[mp].length, 0);
    const target = totalStrong > 0 ? strong : weak;
    for (const mp of ALL_MARKETPLACES) {
      void applyAssignments(mp)(target[mp]);
    }
  };
  useHotkey("Mod+Enter", acceptAll, { enabled: !isSaving });

  if (isLoading || !data) {
    return <Skeleton className="h-40 w-full" />;
  }

  const group = data.group;
  if (!group) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          No marketplace products linked to this card.
        </p>
        <IgnoredProductsNote />
      </div>
    );
  }

  const handlersFor = (
    marketplace: AdminMarketplaceName,
    m: {
      ignoreVariant: (typeof ignoreVariants)[AdminMarketplaceName];
      ignoreProduct: (typeof ignoreProducts)[AdminMarketplaceName];
      assignToCard: (typeof assignToCards)[AdminMarketplaceName];
      unassign: (typeof unassigns)[AdminMarketplaceName];
      saveMapping: (typeof saveMappings)[AdminMarketplaceName];
    },
  ): MarketplaceHandlers => ({
    onIgnoreVariant: (eid, fin, lang) =>
      void refreshAfter(() =>
        m.ignoreVariant.mutateAsync([{ externalId: eid, finish: fin, language: lang }]),
      ),
    onIgnoreProduct: (eid) =>
      void refreshAfter(() => m.ignoreProduct.mutateAsync([{ externalId: eid }])),
    onAssignToCard: (eid, fin, lang, cid) =>
      void refreshAfter(() =>
        m.assignToCard.mutateAsync({ externalId: eid, finish: fin, language: lang, cardId: cid }),
      ),
    onAssignToPrinting: assignToPrinting(marketplace),
    onBatchAssignToPrintings: (mappings) => void applyAssignments(marketplace)(mappings),
    onUnassign: (eid, fin, lang) =>
      void refreshAfter(() =>
        m.unassign.mutateAsync({ externalId: eid, finish: fin, language: lang }),
      ),
    onUnmapPrinting: (pid, eid, fin, lang) =>
      void refreshAfter(() =>
        unmapPrinting.mutateAsync({
          marketplace,
          printingId: pid,
          externalId: eid,
          finish: fin,
          language: lang,
        }),
      ),
    isIgnoring: m.ignoreVariant.isPending || m.ignoreProduct.isPending,
    isAssigning: m.assignToCard.isPending,
    isAssigningToPrinting: m.saveMapping.isPending,
    isUnassigning: m.unassign.isPending,
    isUnmappingPrinting: unmapPrinting.isPending,
  });

  const handlers = Object.fromEntries(
    ALL_MARKETPLACES.map((marketplace) => [
      marketplace,
      handlersFor(marketplace, {
        ignoreVariant: ignoreVariants[marketplace],
        ignoreProduct: ignoreProducts[marketplace],
        assignToCard: assignToCards[marketplace],
        unassign: unassigns[marketplace],
        saveMapping: saveMappings[marketplace],
      }),
    ]),
  ) as Record<AdminMarketplaceName, MarketplaceHandlers>;

  const suggestions = computeProductSuggestions(group);
  const { strong, weak } = collectSuggestedMappings(group, suggestions);
  const strongCount = ALL_MARKETPLACES.reduce((sum, mp) => sum + strong[mp].length, 0);
  const weakCount = ALL_MARKETPLACES.reduce((sum, mp) => sum + weak[mp].length, 0);
  const offered = strongCount > 0 ? strongCount : weakCount;

  return (
    <PrintingPairNamesContext value={pairNames ?? NO_PAIR_NAMES}>
      <div className="space-y-3">
        {offered > 0 && (
          <div className="flex justify-end">
            <Button disabled={isSaving} onClick={acceptAll}>
              <WandSparklesIcon />
              Accept {offered} {strongCount > 0 ? "strong" : "weak"}{" "}
              {pluralize(offered, "suggestion")}
              <Kbd className="bg-background/20 pointer-events-none ml-1 leading-none text-inherit opacity-60">
                Ctrl &#8629;
              </Kbd>
            </Button>
          </div>
        )}
        <MarketplaceProductsTable
          group={group}
          allCards={data.allCards}
          handlers={handlers}
          suggestions={suggestions}
          onOpenPrinting={onOpenPrinting}
        />
        {pairNames !== undefined && pairNames.size > 0 && (
          <p className="text-muted-foreground text-sm">
            A double-faced printing&apos;s listings are shared with its other face&apos;s card, so
            they are unmapped on the printing&apos;s page.
          </p>
        )}
        <IgnoredProductsNote />
      </div>
    </PrintingPairNamesContext>
  );
}

const NO_PAIR_NAMES: ReadonlyMap<string, string> = new Map();
