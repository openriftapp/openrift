import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { toast } from "sonner";

import {
  acceptCardFieldFn,
  uncheckCandidateCardsFn,
  useAcceptCardField,
  useCheckCandidateCard,
  useCheckCandidateCards,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { acceptFieldWithUndo, revertAcceptedField } from "@/features/admin/lib/accept-undo";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  buildAcceptSubmissionInput,
  submissionTickKeys,
} from "@/features/admin/lib/build-accept-input";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { RecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import {
  queuedWorkspaceWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import { primaryLabel } from "@/features/catalog-workspace/lib/suggestion-labels";
import type {
  CardSuggestions,
  FieldSuggestion,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import {
  enterDifferenceCount,
  suggestionByHotkey,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import {
  discardUndoText,
  undoScope,
  usedUndoText,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withSignal, withWriteSignal } from "@/lib/write-signal";

interface UseCardRecordActionsOptions {
  cardSlug: string;
  detail: AdminCardDetailResponse | undefined;
  model: CardSuggestions | null;
  submissions: readonly AttentionSubmission[];
  canCheck: boolean;
}

export function cardRecordScope(cardSlug: string): (readonly unknown[])[] {
  return [adminKeys.cards.detail(cardSlug), adminKeys.cards.list, adminKeys.workspace];
}

export function useCardRecordActions({
  cardSlug,
  detail,
  model,
  submissions,
  canCheck,
}: UseCardRecordActionsOptions) {
  const scope = cardRecordScope(cardSlug);
  const acceptCardField = useAcceptCardField(scope);
  const checkCandidateCard = useCheckCandidateCard(scope);
  const checkCandidateCards = useCheckCandidateCards(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });
  const { announce, push } = useWorkspaceUndo();
  const queue = useQueueWorkspaceWrite();

  const cardId = detail?.card?.id;
  const record = detail?.card?.name ?? cardSlug;
  const isPending =
    acceptCardField.isPending ||
    checkCandidateCard.isPending ||
    checkCandidateCards.isPending ||
    acceptSubmission.isPending;

  function uncheckEntry(ids: readonly string[], suggestions: number): WorkspaceUndoEntry {
    return {
      ...discardUndoText({ suggestions, images: 0, sources: ids.length, record }),
      invalidates: undoScope(scope),
      undo: async (signal) => {
        await withWriteSignal(signal, () =>
          uncheckCandidateCardsFn({ data: { candidateCardIds: [...ids] }, signal }),
        );
      },
    };
  }

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

  async function acceptWholeSubmission(signal: AbortSignal, candidateCardId: string) {
    const submission = submissions.find((entry) => entry.candidateCardId === candidateCardId);
    if (submission !== undefined) {
      await acceptFromSubmission(signal, candidateCardId, new Set(submissionTickKeys(submission)));
    }
  }

  async function discardSuggestion(signal: AbortSignal, suggestion: FieldSuggestion) {
    if (!canCheck || suggestion.tone !== "source") {
      return;
    }
    const candidateCardId = suggestion.candidateRowId;
    const entry = uncheckEntry([candidateCardId], suggestion.rowDifferences);
    const ok = await runReportedMutation(() =>
      checkCandidateCard.mutateAsync(candidateCardId, { signal }),
    );
    if (ok) {
      announce(entry);
    }
  }

  async function discardRemaining(signal: AbortSignal) {
    const targets = model?.enterTargets ?? [];
    if (targets.length === 0 || cardId === undefined) {
      return;
    }
    const ids = targets.map((target) => target.candidateRowId);
    const entry = uncheckEntry(ids, enterDifferenceCount(targets));
    await checkCandidateCards.mutateAsync({ cardId, candidateCardIds: ids }, { signal });
    push(entry);
  }

  const contributorOpen = (model?.openContributorIds.length ?? 0) > 0;
  const actions: RecordActions = {
    primary: canCheck
      ? {
          label: primaryLabel(model === null ? 0 : enterDifferenceCount(model.enterTargets)),
          disabled: contributorOpen || isPending,
          run: discardRemaining,
        }
      : { label: "Next", disabled: contributorOpen, run: () => Promise.resolve() },
    useSuggestion: async (signal, hotkey) => {
      const suggestion = suggestionByHotkey(model?.suggestions ?? [], hotkey);
      if (suggestion !== undefined && !isPending) {
        await applySuggestion(signal, suggestion);
      }
    },
  };

  return {
    actions,
    applySuggestion: queuedWorkspaceWrite(queue, applySuggestion),
    discardSuggestion: queuedWorkspaceWrite(queue, discardSuggestion),
    acceptWholeSubmission: queuedWorkspaceWrite(queue, acceptWholeSubmission),
    contributorOpen,
    isPending,
  };
}
