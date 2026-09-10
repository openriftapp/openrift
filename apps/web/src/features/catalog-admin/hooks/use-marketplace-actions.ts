import type {
  AdminMarketplaceName,
  UnifiedMappingsCardResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";

import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useUnifiedAssignToCard,
  useUnifiedIgnoreProducts,
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
  useUnifiedUnassignFromCard,
} from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { applyOptimisticAssignments } from "@/features/catalog-admin/lib/marketplace-optimistic";
import type { PrintingAssignment } from "@/features/catalog-admin/lib/marketplace-product-groups";
import { reportMutationError } from "@/lib/query-client";

export interface MarketplaceActions {
  assign: (assignments: readonly PrintingAssignment[]) => void;
  assignToCard: (
    marketplace: AdminMarketplaceName,
    externalId: number,
    finish: string,
    language: string | null,
    cardId: string,
  ) => void;
  unassignFromCard: (
    marketplace: AdminMarketplaceName,
    externalId: number,
    finish: string,
    language: string | null,
  ) => void;
  ignoreVariant: (
    marketplace: AdminMarketplaceName,
    externalId: number,
    finish: string,
    language: string | null,
  ) => void;
  ignoreProduct: (marketplace: AdminMarketplaceName, externalId: number) => void;
  unlink: (
    marketplace: AdminMarketplaceName,
    printingId: string,
    externalId: number,
    finish: string,
    language: string | null,
  ) => void;
  isPending: boolean;
}

export function useMarketplaceActions(cardSlug: string): MarketplaceActions {
  const queryClient = useQueryClient();
  const saves = {
    tcgplayer: useUnifiedSaveMappings("tcgplayer"),
    cardmarket: useUnifiedSaveMappings("cardmarket"),
    cardtrader: useUnifiedSaveMappings("cardtrader"),
  };
  const ignoreVariants = {
    tcgplayer: useUnifiedIgnoreVariants("tcgplayer"),
    cardmarket: useUnifiedIgnoreVariants("cardmarket"),
    cardtrader: useUnifiedIgnoreVariants("cardtrader"),
  };
  const ignoreProducts = {
    tcgplayer: useUnifiedIgnoreProducts("tcgplayer"),
    cardmarket: useUnifiedIgnoreProducts("cardmarket"),
    cardtrader: useUnifiedIgnoreProducts("cardtrader"),
  };
  const assignsToCard = {
    tcgplayer: useUnifiedAssignToCard("tcgplayer"),
    cardmarket: useUnifiedAssignToCard("cardmarket"),
    cardtrader: useUnifiedAssignToCard("cardtrader"),
  };
  const unassigns = {
    tcgplayer: useUnifiedUnassignFromCard("tcgplayer"),
    cardmarket: useUnifiedUnassignFromCard("cardmarket"),
    cardtrader: useUnifiedUnassignFromCard("cardtrader"),
  };
  const unmap = useUnmapMarketplacePrinting([adminKeys.cards.all, adminKeys.unifiedMappings.all]);

  const cardKey = adminKeys.unifiedMappings.byCard(cardSlug);

  const refreshCard = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardSlug) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.unifiedMappings.all });
    },
  };

  const pending = [
    ...Object.values(saves),
    ...Object.values(ignoreVariants),
    ...Object.values(ignoreProducts),
    ...Object.values(assignsToCard),
    ...Object.values(unassigns),
    unmap,
  ].some((mutation) => mutation.isPending);

  return {
    assign: (assignments) => {
      if (assignments.length === 0) {
        return;
      }
      const previous = queryClient.getQueryData<UnifiedMappingsCardResponse>(cardKey);
      if (previous) {
        queryClient.setQueryData(cardKey, applyOptimisticAssignments(previous, assignments));
      }
      for (const [marketplace, entries] of Map.groupBy(assignments, (entry) => entry.marketplace)) {
        saves[marketplace].mutate(
          {
            mappings: entries.map(({ externalId, finish, language, printingId }) => ({
              externalId,
              finish,
              language,
              printingId,
            })),
          },
          {
            onError: (error) => {
              if (previous) {
                queryClient.setQueryData(cardKey, previous);
              }
              reportMutationError(error, queryClient);
            },
            onSuccess: refreshCard.onSuccess,
          },
        );
      }
    },
    assignToCard: (marketplace, externalId, finish, language, cardId) => {
      assignsToCard[marketplace].mutate({ externalId, finish, language, cardId }, refreshCard);
    },
    unassignFromCard: (marketplace, externalId, finish, language) => {
      unassigns[marketplace].mutate({ externalId, finish, language }, refreshCard);
    },
    ignoreVariant: (marketplace, externalId, finish, language) => {
      ignoreVariants[marketplace].mutate([{ externalId, finish, language }], refreshCard);
    },
    ignoreProduct: (marketplace, externalId) => {
      ignoreProducts[marketplace].mutate([{ externalId }], refreshCard);
    },
    unlink: (marketplace, printingId, externalId, finish, language) => {
      unmap.mutate({ marketplace, printingId, externalId, finish, language }, refreshCard);
    },
    isPending: pending,
  };
}
