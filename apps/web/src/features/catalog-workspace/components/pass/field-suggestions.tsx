import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";

import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  ContributionBlock,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import type { SubmissionDecisions } from "@/features/catalog-workspace/components/pass/submission-decisions";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";

export function FieldSuggestions<S extends FieldSuggestion>({
  suggestions,
  detail,
  submissions,
  decisions,
  pending,
  format,
  onUse,
  onDismiss,
}: {
  suggestions: readonly S[];
  detail: AdminCardDetailResponse;
  submissions: readonly AttentionSubmission[];
  decisions: SubmissionDecisions;
  pending: boolean;
  format: (suggestion: S) => {
    value: string;
    preview: ReactNode;
    current?: string;
  };
  onUse: (suggestion: S) => void;
  onDismiss?: (group: readonly S[]) => void;
}) {
  const fromSources = Map.groupBy(
    suggestions.filter((suggestion) => !suggestion.isContributor),
    (suggestion) => `${suggestion.field}:${JSON.stringify(suggestion.proposed)}`,
  );
  const sourceRows = [...fromSources.values()].map((group) => {
    const [first] = group;
    if (first === undefined) {
      return null;
    }
    const { value, preview, current } = format(first);
    return (
      <SourceUse
        key={first.key}
        value={value}
        current={current}
        preview={preview ?? undefined}
        source={group.map((suggestion) => suggestion.sourceLabel).join(", ")}
        onUse={() => onUse(first)}
        onDismiss={onDismiss && (() => onDismiss(group))}
      />
    );
  });
  const contributorRows = suggestions
    .filter((suggestion) => suggestion.isContributor)
    .map((suggestion) => {
      const { value, preview } = format(suggestion);
      const { candidateCardId } = suggestion;
      const { onMove } = decisions;
      return (
        <ContributionBlock
          key={suggestion.key}
          {...passContributor(detail, submissions, candidateCardId)}
          value={preview ?? value}
          pending={pending}
          onUse={() => onUse(suggestion)}
          onReject={() => decisions.onReject(candidateCardId, "Correction")}
          onMove={onMove && (() => onMove(candidateCardId))}
          onMarkApplied={() => decisions.onMarkApplied(candidateCardId)}
        />
      );
    });
  return [...sourceRows, ...contributorRows];
}
