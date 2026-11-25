import type {
  AcceptCardField,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";
import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import type { AcceptSubmissionInput } from "@openrift/shared/contracts/admin/catalog-review";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { pluralize } from "@openrift/shared/strings";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import type { MutationMeta } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  acceptCardFieldFn,
  acceptPrintingFieldFn,
  useAcceptCardField,
  useAcceptPrintingField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import type { FieldAcceptMark } from "@/features/admin/lib/accept-undo";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import type {
  QueryScope,
  WorkspaceUndoText,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

interface FieldAccept<TInput> {
  input: TInput;
  label: string;
  sourceLabel: string;
  previousValue: unknown;
  mark?: FieldAcceptMark;
  undoText?: WorkspaceUndoText;
}

interface PrintingFieldInput {
  printingId: string;
  faceId?: string;
  field: AcceptPrintingField;
  value: unknown;
  source: "provider" | "manual";
}

interface CardFieldInput {
  cardId: string;
  field: AcceptCardField;
  value: unknown;
  source: "provider" | "manual";
}

export function usePrintingFieldAccept(scope: QueryScope, record: string, meta?: MutationMeta) {
  const acceptField = useAcceptPrintingField(scope, meta);
  const { announce } = useWorkspaceUndo();

  function accept(
    signal: AbortSignal,
    { input, label, sourceLabel, previousValue, mark, undoText }: FieldAccept<PrintingFieldInput>,
  ): Promise<boolean> {
    return acceptFieldWithUndo<PrintingFieldInput>({
      accept: withSignal(acceptField.mutateAsync, signal),
      input,
      fieldLabel: label,
      sourceLabel,
      previousValue,
      mark,
      onAccepted: (revert) =>
        announce({
          ...(undoText ?? usedUndoText({ field: label, source: sourceLabel, record })),
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
    accept,
    pending: acceptField.isPending,
    error: acceptField.error,
    reset: acceptField.reset,
  };
}

export function useCardFieldAccept(scope: QueryScope, record: string) {
  const acceptField = useAcceptCardField(scope);
  const { announce } = useWorkspaceUndo();

  function accept(
    signal: AbortSignal,
    { input, label, sourceLabel, previousValue, mark, undoText }: FieldAccept<CardFieldInput>,
  ): Promise<boolean> {
    return acceptFieldWithUndo<CardFieldInput>({
      accept: withSignal(acceptField.mutateAsync, signal),
      input,
      fieldLabel: label,
      sourceLabel,
      previousValue,
      mark,
      onAccepted: (revert) =>
        announce({
          ...(undoText ?? usedUndoText({ field: label, source: sourceLabel, record })),
          invalidates: undoScope(scope),
          undo: (undoSignal) =>
            revertAcceptedField(revert, (data) =>
              withWriteSignal(undoSignal, () => acceptCardFieldFn({ data, signal: undoSignal })),
            ),
        }),
    });
  }

  return { accept, pending: acceptField.isPending };
}

export function useContributorAccept(scope: QueryScope, cardSlug?: string) {
  const queryClient = useQueryClient();
  const acceptSubmission = useAcceptSubmission(cardSlug === undefined ? {} : { cardSlug });

  async function accept(
    signal: AbortSignal,
    input: AcceptSubmissionInput,
    submitterName: string,
  ): Promise<boolean> {
    let result: Awaited<ReturnType<typeof acceptSubmission.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await acceptSubmission.mutateAsync(input, { signal });
    });
    if (!ok || !result) {
      return false;
    }
    toast.success(
      `Accepted ${result.applied} ${pluralize(result.applied, "change")} from ${submitterName}`,
    );
    for (const key of scope) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
    return true;
  }

  return { accept, pending: acceptSubmission.isPending };
}

/** A release date is written with its precision, and undoes to the pair it replaced. */
function printingSuggestionValues(
  suggestion: PrintingFieldSuggestion,
  printing: Pick<AdminPrintingResponse, "releasedAt" | "releasePrecision"> | null,
): { value: unknown; previousValue: unknown } {
  if (suggestion.field !== "releasedAt") {
    return { value: suggestion.proposed, previousValue: suggestion.current };
  }
  return {
    value: { releasedAt: suggestion.proposed, releasePrecision: suggestion.releasePrecision },
    previousValue:
      printing === null
        ? suggestion.current
        : { releasedAt: printing.releasedAt, releasePrecision: printing.releasePrecision },
  };
}

export function usePrintingSuggestionApply({
  scope,
  record,
  cardSlug,
  printing,
  contributorName,
}: {
  scope: QueryScope;
  record: string;
  cardSlug?: string;
  printing: Pick<AdminPrintingResponse, "releasedAt" | "releasePrecision"> | null;
  contributorName: (candidateCardId: string) => string;
}) {
  const fieldAccept = usePrintingFieldAccept(scope, record);
  const contributor = useContributorAccept(scope, cardSlug);

  async function apply(
    signal: AbortSignal,
    suggestion: PrintingFieldSuggestion,
    mark?: FieldAcceptMark,
  ): Promise<void> {
    if (!isAcceptPrintingField(suggestion.field)) {
      return;
    }
    const field = suggestion.field;
    const { value, previousValue } = printingSuggestionValues(suggestion, printing);
    const target = {
      printingId: suggestion.printingId,
      ...(!isPrintingLevelField(field) && { faceId: suggestion.faceId }),
    };
    if (suggestion.isContributor) {
      await contributor.accept(
        signal,
        {
          candidateCardId: suggestion.candidateCardId,
          printingFields: [{ ...target, field, value, source: "provider" }],
        },
        contributorName(suggestion.candidateCardId),
      );
      return;
    }
    await fieldAccept.accept(signal, {
      input: { ...target, field, value, source: "provider" },
      label: suggestion.label,
      sourceLabel: suggestion.sourceLabel,
      previousValue,
      mark,
    });
  }

  return { apply, pending: fieldAccept.pending || contributor.pending };
}
