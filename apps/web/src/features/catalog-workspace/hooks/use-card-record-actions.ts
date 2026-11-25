import { isAcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import type { FieldAcceptMark } from "@/features/admin/lib/accept-undo";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { buildAcceptSubmissionInput } from "@/features/admin/lib/build-accept-input";
import {
  useCardFieldAccept,
  useContributorAccept,
} from "@/features/catalog-workspace/hooks/use-suggestion-writes";
import {
  queuedFieldWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";

export function useCardRecordActions({
  cardSlug,
  detail,
  submissions,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse | undefined;
  submissions: readonly AttentionSubmission[];
}) {
  const scope = cardRecordScope(cardSlug);
  const record = detail?.card?.name ?? cardSlug;
  const fieldAccept = useCardFieldAccept(scope, record);
  const contributor = useContributorAccept(scope, cardSlug);
  const queue = useQueueWorkspaceWrite();
  const cardId = detail?.card?.id;

  async function apply(
    signal: AbortSignal,
    mark: FieldAcceptMark,
    suggestion: FieldSuggestion,
  ): Promise<void> {
    if (suggestion.isContributor) {
      const submission = submissions.find(
        (entry) => entry.candidateCardId === suggestion.candidateCardId,
      );
      if (submission === undefined || suggestion.changeKey === undefined) {
        return;
      }
      const { input } = buildAcceptSubmissionInput(submission, {
        ticked: new Set([suggestion.changeKey]),
        edits: new Map(),
      });
      await contributor.accept(signal, input, suggestion.sourceLabel);
      return;
    }
    if (cardId === undefined || !isAcceptCardField(suggestion.field)) {
      return;
    }
    await fieldAccept.accept(signal, {
      input: { cardId, field: suggestion.field, value: suggestion.proposed, source: "provider" },
      label: suggestion.label,
      sourceLabel: suggestion.sourceLabel,
      previousValue: suggestion.current,
      mark,
    });
  }

  return {
    apply: queuedFieldWrite(queue, apply),
    pending: fieldAccept.pending || contributor.pending,
  };
}
