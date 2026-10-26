import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { toast } from "sonner";

import {
  useAcceptCardField,
  useCheckCandidateCard,
  useUncheckCandidateCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  buildAcceptSubmissionInput,
  submissionTickKeys,
} from "@/features/admin/lib/build-accept-input";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { RecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type {
  CardSuggestions,
  FieldSuggestion,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import {
  enterDifferenceCount,
  suggestionByHotkey,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";

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

export function primaryLabel(model: CardSuggestions | null, canCheck: boolean): string {
  const differences = model === null ? 0 : enterDifferenceCount(model.enterTargets);
  return canCheck && differences > 0 ? `Discard ${differences} & next` : "Next";
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
  const uncheckCandidateCard = useUncheckCandidateCard(scope);
  const acceptSubmission = useAcceptSubmission({ cardSlug });
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);
  const removeUndo = useWorkspaceSelectionStore((state) => state.removeUndo);

  const cardId = detail?.card?.id;
  const isPending =
    acceptCardField.isPending ||
    checkCandidateCard.isPending ||
    uncheckCandidateCard.isPending ||
    acceptSubmission.isPending;

  function announce(entry: WorkspaceUndoEntry) {
    pushUndo(entry);
    toast.success(entry.label, {
      action: {
        label: "Undo (Z)",
        onClick: () => {
          if (removeUndo(entry)) {
            void entry.undo();
          }
        },
      },
    });
  }

  function applySourceSuggestion(suggestion: FieldSuggestion) {
    if (cardId === undefined) {
      return;
    }
    const label = CARD_FIELD_LABELS[suggestion.field];
    const previous = (detail?.card as Record<string, unknown> | null)?.[suggestion.field] ?? null;
    acceptCardField.mutate(
      { cardId, field: suggestion.field, value: suggestion.value, source: "provider" },
      {
        onSuccess: () =>
          announce({
            label: `Used ${label} from ${suggestion.sourceLabel}`,
            undo: async () => {
              await acceptCardField.mutateAsync({
                cardId,
                field: suggestion.field,
                value: previous,
                source: "manual",
              });
            },
          }),
      },
    );
  }

  function acceptFromSubmission(candidateCardId: string, ticked: ReadonlySet<string>) {
    const submission = submissions.find((entry) => entry.candidateCardId === candidateCardId);
    if (submission === undefined) {
      return;
    }
    const { input } = buildAcceptSubmissionInput(submission, { ticked, edits: new Map() });
    acceptSubmission.mutate(input, {
      onSuccess: (result) => {
        toast.success(
          `Accepted ${result.applied} ${pluralize(result.applied, "change")} from ${submission.submitterName ?? "the contributor"}`,
        );
      },
    });
  }

  function applySuggestion(suggestion: FieldSuggestion) {
    if (suggestion.tone === "contributor") {
      if (suggestion.changeKey !== undefined) {
        acceptFromSubmission(suggestion.candidateRowId, new Set([suggestion.changeKey]));
      }
      return;
    }
    applySourceSuggestion(suggestion);
  }

  function acceptWholeSubmission(candidateCardId: string) {
    const submission = submissions.find((entry) => entry.candidateCardId === candidateCardId);
    if (submission !== undefined) {
      acceptFromSubmission(candidateCardId, new Set(submissionTickKeys(submission)));
    }
  }

  function discardSuggestion(suggestion: FieldSuggestion) {
    if (!canCheck || suggestion.tone !== "source") {
      return;
    }
    const candidateCardId = suggestion.candidateRowId;
    checkCandidateCard.mutate(candidateCardId, {
      onSuccess: () =>
        announce({
          label: `Discarded ${suggestion.rowDifferences} ${pluralize(suggestion.rowDifferences, "suggestion")} from ${suggestion.sourceLabel}`,
          undo: async () => {
            await uncheckCandidateCard.mutateAsync(candidateCardId);
          },
        }),
    });
  }

  async function discardRemaining() {
    const targets = model?.enterTargets ?? [];
    if (targets.length === 0) {
      return;
    }
    const ids = targets.map((target) => target.candidateRowId);
    await Promise.all(ids.map((id) => checkCandidateCard.mutateAsync(id)));
    const differences = enterDifferenceCount(targets);
    pushUndo({
      label: `Discarded ${differences} ${pluralize(differences, "suggestion")} on ${detail?.card?.name ?? cardSlug}`,
      undo: async () => {
        await Promise.all(ids.map((id) => uncheckCandidateCard.mutateAsync(id)));
      },
    });
  }

  const contributorOpen = (model?.openContributorIds.length ?? 0) > 0;
  const actions: RecordActions = {
    primary: canCheck
      ? {
          label: primaryLabel(model, canCheck),
          disabled: contributorOpen || isPending,
          run: discardRemaining,
        }
      : { label: "Next", disabled: contributorOpen, run: () => Promise.resolve() },
    useSuggestion: (hotkey) => {
      const suggestion = suggestionByHotkey(model?.suggestions ?? [], hotkey);
      if (suggestion !== undefined && !isPending) {
        applySuggestion(suggestion);
      }
    },
  };

  return {
    actions,
    applySuggestion,
    discardSuggestion,
    acceptWholeSubmission,
    contributorOpen,
    isPending,
  };
}
