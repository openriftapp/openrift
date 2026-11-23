import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { toast } from "sonner";

import {
  acceptCardFieldFn,
  useAcceptCardField,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { buildAcceptSubmissionInput } from "@/features/admin/lib/build-accept-input";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import {
  queuedWorkspaceWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { undoScope, usedUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

interface UseCardRecordActionsOptions {
  cardSlug: string;
  detail: AdminCardDetailResponse | undefined;
  submissions: readonly AttentionSubmission[];
}

export function cardRecordScope(cardSlug: string): (readonly unknown[])[] {
  return [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
}

export function useCardRecordActions({
  cardSlug,
  detail,
  submissions,
}: UseCardRecordActionsOptions) {
  const scope = cardRecordScope(cardSlug);
  const acceptCardField = useAcceptCardField(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });
  const { announce } = useWorkspaceUndo();
  const queue = useQueueWorkspaceWrite();

  const cardId = detail?.card?.id;
  const record = detail?.card?.name ?? cardSlug;
  const isPending = acceptCardField.isPending || acceptSubmission.isPending;

  async function applySourceSuggestion(
    signal: AbortSignal,
    suggestion: FieldSuggestion,
  ): Promise<void> {
    if (cardId === undefined) {
      return;
    }
    const label = CARD_FIELD_LABELS[suggestion.field];
    const accept = withSignal(acceptCardField.mutateAsync, signal);
    await acceptFieldWithUndo({
      accept,
      input: { cardId, field: suggestion.field, value: suggestion.value, source: "provider" },
      fieldLabel: label,
      sourceLabel: suggestion.sourceLabel,
      previousValue: (detail?.card as Record<string, unknown> | null)?.[suggestion.field],
      onAccepted: (revert) =>
        announce({
          ...usedUndoText({ field: label, source: suggestion.sourceLabel, record }),
          invalidates: undoScope(scope),
          undo: (undoSignal) =>
            revertAcceptedField(revert, (data) =>
              withWriteSignal(undoSignal, () => acceptCardFieldFn({ data, signal: undoSignal })),
            ),
        }),
    });
  }

  async function acceptFromSubmission(
    signal: AbortSignal,
    candidateCardId: string,
    ticked: ReadonlySet<string>,
  ) {
    const submission = submissions.find((entry) => entry.candidateCardId === candidateCardId);
    if (submission === undefined) {
      return;
    }
    const { input } = buildAcceptSubmissionInput(submission, { ticked, edits: new Map() });
    let result: Awaited<ReturnType<typeof acceptSubmission.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await acceptSubmission.mutateAsync(input, { signal });
    });
    if (ok && result) {
      toast.success(
        `Accepted ${result.applied} ${pluralize(result.applied, "change")} from ${submission.submitterName ?? "the contributor"}`,
      );
    }
  }

  async function applySuggestion(signal: AbortSignal, suggestion: FieldSuggestion): Promise<void> {
    if (suggestion.tone === "contributor") {
      if (suggestion.changeKey !== undefined) {
        await acceptFromSubmission(
          signal,
          suggestion.candidateRowId,
          new Set([suggestion.changeKey]),
        );
      }
      return;
    }
    await applySourceSuggestion(signal, suggestion);
  }

  return {
    applySuggestion: queuedWorkspaceWrite(queue, applySuggestion),
    isPending,
  };
}
