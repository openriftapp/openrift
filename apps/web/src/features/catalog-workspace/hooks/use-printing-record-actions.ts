import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";

import { useAcceptPrintingField } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAcceptSubmission,
  useRejectSubmission,
} from "@/features/admin/hooks/use-catalog-review";
import {
  useUnifiedIgnoreVariants,
  useUnifiedSaveMappings,
} from "@/features/admin/hooks/use-unified-mappings";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useCandidateDiscards } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { primaryLabel } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type {
  ListingSuggestion,
  PrintingSuggestionModel,
} from "@/features/catalog-workspace/lib/printing-suggestion-rows";

export type PrintingChip =
  | { kind: "field"; key: string; suggestion: FieldSuggestion }
  | { kind: "listing"; key: string; listing: ListingSuggestion };

export function printingChips(
  model: PrintingSuggestionModel,
  listings: readonly ListingSuggestion[],
): PrintingChip[] {
  return [
    ...model.suggestions.map((suggestion): PrintingChip => ({
      kind: "field",
      key: suggestion.key,
      suggestion,
    })),
    ...listings.map((listing): PrintingChip => ({ kind: "listing", key: listing.key, listing })),
  ];
}

export function usePrintingRecordActions({
  printingId,
  model,
  listings,
  canCheck,
  canMap,
}: {
  printingId: string;
  model: PrintingSuggestionModel;
  listings: readonly ListingSuggestion[];
  canCheck: boolean;
  canMap: boolean;
}) {
  const queryClient = useQueryClient();
  const scope = [adminKeys.cards.all, adminKeys.printingDesk.all, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const discards = useCandidateDiscards(scope, model.sources);
  const acceptSubmission = useAcceptSubmission();
  const rejectSubmission = useRejectSubmission();
  const save: Record<AdminMarketplaceName, ReturnType<typeof useUnifiedSaveMappings>> = {
    tcgplayer: useUnifiedSaveMappings("tcgplayer"),
    cardmarket: useUnifiedSaveMappings("cardmarket"),
    cardtrader: useUnifiedSaveMappings("cardtrader"),
    cardnexus: useUnifiedSaveMappings("cardnexus"),
  };
  const ignore: Record<AdminMarketplaceName, ReturnType<typeof useUnifiedIgnoreVariants>> = {
    tcgplayer: useUnifiedIgnoreVariants("tcgplayer"),
    cardmarket: useUnifiedIgnoreVariants("cardmarket"),
    cardtrader: useUnifiedIgnoreVariants("cardtrader"),
    cardnexus: useUnifiedIgnoreVariants("cardnexus"),
  };

  const chips = printingChips(model, canMap ? listings : []);
  const enterIds = canCheck ? model.enterCandidateIds : [];
  const pending =
    acceptField.isPending ||
    discards.pending ||
    acceptSubmission.isPending ||
    rejectSubmission.isPending;

  function settleCards() {
    void queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    void queryClient.invalidateQueries({ queryKey: adminKeys.cards.all });
  }

  function applyField(suggestion: FieldSuggestion) {
    if (!isAcceptPrintingField(suggestion.field)) {
      return;
    }
    const field = suggestion.field;
    const value =
      field === "releasedAt"
        ? {
            releasedAt: suggestion.proposed,
            releasePrecision: suggestion.candidate.releasePrecision,
          }
        : suggestion.proposed;
    const undoValue =
      field === "releasedAt" && model.printing !== null
        ? {
            releasedAt: model.printing.releasedAt,
            releasePrecision: model.printing.releasePrecision,
          }
        : suggestion.current;
    if (suggestion.isContributor) {
      acceptSubmission.mutate(
        {
          candidateCardId: suggestion.candidate.candidateCardId,
          printingFields: [{ printingId, field, value, source: "provider" }],
        },
        { onSettled: settleCards },
      );
      return;
    }
    acceptField.mutate({ printingId, field, value, source: "provider" });
    toastFieldAccepted({
      fieldLabel: suggestion.label,
      sourceLabel: suggestion.provider,
      previousValue: undoValue,
      onUndo: (previous) =>
        acceptField.mutate({ printingId, field, value: previous, source: "manual" }),
    });
  }

  function mapListing(listing: ListingSuggestion) {
    save[listing.marketplace].mutate(
      {
        mappings: [
          {
            externalId: listing.product.externalId,
            finish: listing.product.finish,
            language: listing.product.language,
            printingId,
          },
        ],
      },
      { onSettled: settleCards },
    );
  }

  function ignoreListing(listing: ListingSuggestion) {
    ignore[listing.marketplace].mutate(
      [
        {
          externalId: listing.product.externalId,
          finish: listing.product.finish,
          language: listing.product.language,
        },
      ],
      { onSettled: settleCards },
    );
  }

  function applyChip(chip: PrintingChip) {
    if (chip.kind === "field") {
      applyField(chip.suggestion);
    } else {
      mapListing(chip.listing);
    }
  }

  async function runPrimary() {
    await discards.discardAll(enterIds);
  }

  useRegisterRecordActions({
    primary: canCheck
      ? { label: primaryLabel(enterIds.length), disabled: pending, run: runPrimary }
      : undefined,
    useSuggestion: (n) => {
      const chip = chips[n - 1];
      if (chip !== undefined) {
        applyChip(chip);
      }
    },
  });

  return {
    chips,
    enterCount: enterIds.length,
    pending,
    applyChip,
    mapListing,
    ignoreListing,
    discard: discards.discard,
    reject: (candidateCardId: string) =>
      rejectSubmission.mutate({ candidateCardId, note: null }, { onSettled: settleCards }),
    runPrimary,
  };
}
