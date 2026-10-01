import type {
  AdminMarketplaceName,
  UnifiedMappingGroupResponse,
  UnifiedMappingsCardResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WandSparklesIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { IgnoredProductsNote } from "@/features/admin/components/ignored-products-note";
import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useUnifiedAssignToCard,
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
  useUnifiedUnassignFromCard,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";

import type { MarketplaceHandlers } from "./marketplace-product-entries";
import { collectStrongMappings, collectWeakMappings } from "./marketplace-product-entries";
import { MarketplaceProductsTable } from "./marketplace-products-table";
import { computeProductSuggestions } from "./suggest-mapping";

export function AdminCardMarketplaceSection({
  cardId,
  onOpenPrinting,
}: {
  cardId: string;
  onOpenPrinting?: (printingId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(unifiedMappingsForCardQueryOptions(cardId));

  // Invalidates both the per-card cache this page reads and the corpus-wide
  // cache (coverage badges, unmatched products on /admin/cards) so they can't disagree.
  const mutateOpts = {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardId) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.unifiedMappings.all }),
      ]);
    },
  };

  const cardKey = adminKeys.unifiedMappings.byCard(cardId);

  // Optimistic path: without this, chips stay on screen until the
  // unifiedMappings refetch finishes. On error, rolls back to the pre-batch snapshot.
  const applyAssignments =
    (marketplace: AdminMarketplaceName) =>
    (
      mappings: {
        externalId: number;
        finish: string;
        language: string | null;
        printingId: string;
      }[],
    ) => {
      if (mappings.length === 0) {
        return;
      }
      const previous = queryClient.getQueryData<UnifiedMappingsCardResponse>(cardKey);
      if (previous) {
        let next = previous;
        for (const m of mappings) {
          next = applyOptimisticAssignmentForCard(
            next,
            marketplace,
            m.externalId,
            m.finish,
            m.language,
            m.printingId,
          );
        }
        if (next !== previous) {
          queryClient.setQueryData(cardKey, next);
        }
      }
      const save = {
        tcgplayer: tcgSaveMapping,
        cardmarket: cmSaveMapping,
        cardtrader: ctSaveMapping,
        cardnexus: cnSaveMapping,
      }[marketplace];
      save.mutate(
        { mappings },
        {
          onError: () => {
            if (previous) {
              queryClient.setQueryData(cardKey, previous);
            }
          },
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: adminKeys.cards.detail(cardId),
            });
          },
        },
      );
    };

  const assignToPrinting =
    (marketplace: AdminMarketplaceName) =>
    (eid: number, finish: string, language: string | null, pid: string) => {
      applyAssignments(marketplace)([{ externalId: eid, finish, language, printingId: pid }]);
    };

  const tcgIgnoreVariant = useUnifiedIgnoreVariants("tcgplayer");
  const cmIgnoreVariant = useUnifiedIgnoreVariants("cardmarket");
  const ctIgnoreVariant = useUnifiedIgnoreVariants("cardtrader");
  const cnIgnoreVariant = useUnifiedIgnoreVariants("cardnexus");
  const tcgIgnoreProduct = useUnifiedIgnoreProducts("tcgplayer");
  const cmIgnoreProduct = useUnifiedIgnoreProducts("cardmarket");
  const ctIgnoreProduct = useUnifiedIgnoreProducts("cardtrader");
  const cnIgnoreProduct = useUnifiedIgnoreProducts("cardnexus");
  const tcgAssignToCard = useUnifiedAssignToCard("tcgplayer");
  const cmAssignToCard = useUnifiedAssignToCard("cardmarket");
  const ctAssignToCard = useUnifiedAssignToCard("cardtrader");
  const cnAssignToCard = useUnifiedAssignToCard("cardnexus");
  const tcgUnassign = useUnifiedUnassignFromCard("tcgplayer");
  const cmUnassign = useUnifiedUnassignFromCard("cardmarket");
  const ctUnassign = useUnifiedUnassignFromCard("cardtrader");
  const cnUnassign = useUnifiedUnassignFromCard("cardnexus");
  const tcgSaveMapping = useUnifiedSaveMappings("tcgplayer");
  const cmSaveMapping = useUnifiedSaveMappings("cardmarket");
  const ctSaveMapping = useUnifiedSaveMappings("cardtrader");
  const cnSaveMapping = useUnifiedSaveMappings("cardnexus");
  const unmapPrinting = useUnmapMarketplacePrinting([
    adminKeys.cards.detail(cardId),
    adminKeys.unifiedMappings.all,
  ]);

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const acceptAllRef = useRef<() => void>(() => {});
  const isSaving =
    tcgSaveMapping.isPending ||
    cmSaveMapping.isPending ||
    ctSaveMapping.isPending ||
    cnSaveMapping.isPending;
  useHotkey("Mod+Enter", () => acceptAllRef.current(), { enabled: !isSaving });
  // Install the latest accept-all closure every render so the hotkey fires
  // against the current data/handlers without needing a stale dep list.
  useEffect(() => {
    const group = data?.group;
    if (!group) {
      // oxlint-disable-next-line no-empty-function -- no-op when there's no data yet
      acceptAllRef.current = () => {};
      return;
    }
    const suggestions = computeProductSuggestions(group);
    const strong = collectStrongMappings(group, suggestions);
    const weak = collectWeakMappings(group, suggestions);
    // Strong wins when both are present, so Ctrl+Enter never accepts a
    // low-confidence match while a strong one is still on the page.
    const totalStrong = ALL_MARKETPLACES.reduce((sum, mp) => sum + strong[mp].length, 0);
    acceptAllRef.current = () => {
      const target = totalStrong > 0 ? strong : weak;
      for (const mp of ALL_MARKETPLACES) {
        const mappings = target[mp];
        if (mappings.length > 0) {
          applyAssignments(mp)(mappings);
        }
      }
    };
  });

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
      ignoreVariant: typeof tcgIgnoreVariant;
      ignoreProduct: typeof tcgIgnoreProduct;
      assignToCard: typeof tcgAssignToCard;
      unassign: typeof tcgUnassign;
      saveMapping: typeof tcgSaveMapping;
    },
  ): MarketplaceHandlers => ({
    onIgnoreVariant: (eid, fin, lang) =>
      m.ignoreVariant.mutate([{ externalId: eid, finish: fin, language: lang }], mutateOpts),
    onIgnoreProduct: (eid) => m.ignoreProduct.mutate([{ externalId: eid }], mutateOpts),
    onAssignToCard: (eid, fin, lang, cid) =>
      m.assignToCard.mutate(
        { externalId: eid, finish: fin, language: lang, cardId: cid },
        mutateOpts,
      ),
    onAssignToPrinting: assignToPrinting(marketplace),
    onBatchAssignToPrintings: applyAssignments(marketplace),
    onUnassign: (eid, fin, lang) =>
      m.unassign.mutate({ externalId: eid, finish: fin, language: lang }, mutateOpts),
    onUnmapPrinting: (pid, eid, fin, lang) =>
      unmapPrinting.mutate(
        { marketplace, printingId: pid, externalId: eid, finish: fin, language: lang },
        mutateOpts,
      ),
    isIgnoring: m.ignoreVariant.isPending || m.ignoreProduct.isPending,
    isAssigning: m.assignToCard.isPending,
    isAssigningToPrinting: m.saveMapping.isPending,
    isUnassigning: m.unassign.isPending,
    isUnmappingPrinting: unmapPrinting.isPending,
  });

  const handlers: Record<AdminMarketplaceName, MarketplaceHandlers> = {
    tcgplayer: handlersFor("tcgplayer", {
      ignoreVariant: tcgIgnoreVariant,
      ignoreProduct: tcgIgnoreProduct,
      assignToCard: tcgAssignToCard,
      unassign: tcgUnassign,
      saveMapping: tcgSaveMapping,
    }),
    cardmarket: handlersFor("cardmarket", {
      ignoreVariant: cmIgnoreVariant,
      ignoreProduct: cmIgnoreProduct,
      assignToCard: cmAssignToCard,
      unassign: cmUnassign,
      saveMapping: cmSaveMapping,
    }),
    cardtrader: handlersFor("cardtrader", {
      ignoreVariant: ctIgnoreVariant,
      ignoreProduct: ctIgnoreProduct,
      assignToCard: ctAssignToCard,
      unassign: ctUnassign,
      saveMapping: ctSaveMapping,
    }),
    cardnexus: handlersFor("cardnexus", {
      ignoreVariant: cnIgnoreVariant,
      ignoreProduct: cnIgnoreProduct,
      assignToCard: cnAssignToCard,
      unassign: cnUnassign,
      saveMapping: cnSaveMapping,
    }),
  };

  const suggestions = computeProductSuggestions(group);
  const strong = collectStrongMappings(group, suggestions);
  const weak = collectWeakMappings(group, suggestions);
  const strongCount = ALL_MARKETPLACES.reduce((sum, mp) => sum + strong[mp].length, 0);
  const weakCount = ALL_MARKETPLACES.reduce((sum, mp) => sum + weak[mp].length, 0);
  const offered = strongCount > 0 ? strongCount : weakCount;

  return (
    <div className="space-y-3">
      {offered > 0 && (
        <div className="flex justify-end">
          <Button disabled={isSaving} onClick={() => acceptAllRef.current()}>
            <WandSparklesIcon />
            Accept {offered} {strongCount > 0 ? "strong" : "weak"} suggestion
            {offered === 1 ? "" : "s"}
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
      <IgnoredProductsNote />
    </div>
  );
}

/**
 * SKU is matched by the `(externalId, finish, language)` tuple the caller
 * passes through — finish/language describe the marketplace's SKU, not the printing's.
 */
function applyOptimisticAssignmentToGroup(
  group: UnifiedMappingGroupResponse,
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
  printingId: string,
): UnifiedMappingGroupResponse {
  const printing = group.printings.find((p) => p.printingId === printingId);
  if (!printing) {
    return group;
  }
  const mk = group[marketplace];
  const variantIdx = mk.stagedProducts.findIndex(
    (p) => p.externalId === externalId && p.finish === finish && p.language === language,
  );
  const variant = variantIdx === -1 ? undefined : mk.stagedProducts[variantIdx];
  const nextStaged =
    variantIdx === -1
      ? mk.stagedProducts
      : [...mk.stagedProducts.slice(0, variantIdx), ...mk.stagedProducts.slice(variantIdx + 1)];
  const nextAssigned = variant ? [...mk.assignedProducts, variant] : mk.assignedProducts;
  const nextAssignments = [
    ...mk.assignments,
    {
      externalId,
      printingId,
      finish,
      language,
    },
  ];
  return {
    ...group,
    [marketplace]: {
      ...mk,
      stagedProducts: nextStaged,
      assignedProducts: nextAssigned,
      assignments: nextAssignments,
    },
  };
}

/** Folds a single (product SKU → printing) assignment into the cached {@link UnifiedMappingsCardResponse}. */
export function applyOptimisticAssignmentForCard(
  response: UnifiedMappingsCardResponse,
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
  printingId: string,
): UnifiedMappingsCardResponse {
  if (!response.group) {
    return response;
  }
  const nextGroup = applyOptimisticAssignmentToGroup(
    response.group,
    marketplace,
    externalId,
    finish,
    language,
    printingId,
  );
  if (nextGroup === response.group) {
    return response;
  }
  return { ...response, group: nextGroup };
}
