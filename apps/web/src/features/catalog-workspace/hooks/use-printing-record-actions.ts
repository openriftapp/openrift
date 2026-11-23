import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";

import {
  acceptPrintingFieldFn,
  useAcceptPrintingField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

export function usePrintingFieldWrites({
  printingId,
  record,
  printing,
}: {
  printingId: string;
  record: string;
  printing: AdminPrintingResponse | null;
}) {
  const queryClient = useQueryClient();
  const scope = [adminKeys.cards.all, adminKeys.printingDesk.all, adminKeys.workspace];
  const acceptField = useAcceptPrintingField(scope);
  const { announce } = useWorkspaceUndo();
  const acceptSubmission = useAcceptSubmission();

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
      field === "releasedAt" && printing !== null
        ? { releasedAt: printing.releasedAt, releasePrecision: printing.releasePrecision }
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

  return {
    applyField,
    settleCards,
    pending: acceptField.isPending || acceptSubmission.isPending,
  };
}
