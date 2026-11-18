import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { useQueryClient } from "@tanstack/react-query";

import {
  acceptPrintingFieldFn,
  useAcceptPrintingField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import {
  useIgnoreVariantsByMarketplace,
  useSaveMappingsByMarketplace,
} from "@/features/admin/hooks/use-unified-mappings";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  assignedListingUndo,
  ignoredVariantsUndo,
} from "@/features/catalog-workspace/hooks/listing-undo";
import { useCandidateDiscards } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import {
  queuedWorkspaceWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type {
  ListingSuggestion,
  PrintingSuggestionModel,
} from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { primaryLabel } from "@/features/catalog-workspace/lib/suggestion-labels";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

function skuOf(listing: ListingSuggestion) {
  return {
    externalId: listing.product.externalId,
    finish: listing.product.finish,
    language: listing.product.language,
  };
}

export type PrintingChip =
  | { kind: "field"; key: string; suggestion: PrintingFieldSuggestion }
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
  record,
  model,
  listings,
  canCheck,
  canMap,
  loading = false,
}: {
  printingId: string;
  record: string;
  model: PrintingSuggestionModel;
  listings: readonly ListingSuggestion[];
  canCheck: boolean;
  canMap: boolean;
  loading?: boolean;
}) {
  const queryClient = useQueryClient();
  const queue = useQueueWorkspaceWrite();
  const scope = [adminKeys.cards.all, adminKeys.printingDesk.all, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const discards = useCandidateDiscards({ scope, sources: model.sources, record });
  const { announce } = useWorkspaceUndo();
  const acceptSubmission = useAcceptSubmission();
  const save = useSaveMappingsByMarketplace();
  const ignore = useIgnoreVariantsByMarketplace();

  const chips = printingChips(model, canMap ? listings : []);
  const enterIds = canCheck ? model.enterCandidateIds : [];
  const pending = acceptField.isPending || discards.pending || acceptSubmission.isPending;

  function settleCards() {
    void queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
    void queryClient.invalidateQueries({ queryKey: adminKeys.cards.all });
  }

  async function applyField(
    signal: AbortSignal,
    suggestion: PrintingFieldSuggestion,
  ): Promise<void> {
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
      await runReportedMutation(() =>
        acceptSubmission.mutateAsync(
          {
            candidateCardId: suggestion.candidate.candidateCardId,
            printingFields: [{ printingId, field, value, source: "provider" }],
          },
          { signal },
        ),
      );
      settleCards();
      return;
    }
    const accept = withSignal(acceptField.mutateAsync, signal);
    await acceptFieldWithUndo({
      accept,
      input: { printingId, field, value, source: "provider" },
      fieldLabel: suggestion.label,
      sourceLabel: suggestion.provider,
      previousValue: undoValue,
      onAccepted: (revert) =>
        announce({
          ...usedUndoText({ field: suggestion.label, source: suggestion.provider, record }),
          invalidates: undoScope(scope),
          undo: (undoSignal) =>
            revertAcceptedField(revert, (data) =>
              withWriteSignal(undoSignal, () =>
                acceptPrintingFieldFn({ data, signal: undoSignal }),
              ),
            ),
        }),
    });
  }

  async function mapListing(signal: AbortSignal, listing: ListingSuggestion): Promise<void> {
    const sku = skuOf(listing);
    let result: Awaited<ReturnType<(typeof save)["tcgplayer"]["mutateAsync"]>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await save[listing.marketplace].mutateAsync(
        { mappings: [{ ...sku, printingId }] },
        { signal },
      );
    });
    settleCards();
    if (ok && result && result.skipped.length === 0) {
      announce(assignedListingUndo(listing.marketplace, sku, printingId, record));
    }
  }

  async function ignoreListing(signal: AbortSignal, listing: ListingSuggestion): Promise<void> {
    const sku = skuOf(listing);
    const ok = await runReportedMutation(() =>
      ignore[listing.marketplace].mutateAsync([sku], { signal }),
    );
    settleCards();
    if (ok) {
      announce(ignoredVariantsUndo(listing.marketplace, [sku], record));
    }
  }

  function applyChip(signal: AbortSignal, chip: PrintingChip): Promise<void> {
    return chip.kind === "field"
      ? applyField(signal, chip.suggestion)
      : mapListing(signal, chip.listing);
  }

  async function runPrimary(signal: AbortSignal) {
    await discards.discardAll(signal, enterIds);
  }

  useRegisterRecordActions({
    loading,
    primary: canCheck
      ? { label: primaryLabel(enterIds.length), disabled: pending, run: runPrimary }
      : undefined,
    useSuggestion: async (signal, n) => {
      const chip = chips[n - 1];
      if (chip !== undefined) {
        await applyChip(signal, chip);
      }
    },
  });

  return {
    chips,
    enterCount: enterIds.length,
    pending,
    applyChip: queuedWorkspaceWrite(queue, applyChip),
    mapListing: queuedWorkspaceWrite(queue, mapListing),
    ignoreListing: queuedWorkspaceWrite(queue, ignoreListing),
    discard: queuedWorkspaceWrite(queue, discards.discard),
    settleCards,
    runPrimary: queuedWorkspaceWrite(queue, runPrimary),
  };
}
