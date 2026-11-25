import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";

import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  ContributionBlock,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import type { SubmissionDecisions } from "@/features/catalog-workspace/components/pass/submission-decisions";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/face-suggestion-rows";

export function FieldSuggestions({
  suggestions,
  detail,
  submissions,
  decisions,
  pending,
  format,
  onUse,
  onDismiss,
}: {
  suggestions: readonly PrintingFieldSuggestion[];
  detail: AdminCardDetailResponse;
  submissions: readonly AttentionSubmission[];
  decisions: SubmissionDecisions;
  pending: boolean;
  format: (suggestion: PrintingFieldSuggestion) => {
    value: string;
    preview: ReactNode;
    current?: string;
  };
  onUse: (suggestion: PrintingFieldSuggestion) => void;
  onDismiss?: (suggestion: PrintingFieldSuggestion) => void;
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
        source={group.map((suggestion) => suggestion.provider).join(", ")}
        pending={pending}
        onUse={() => onUse(first)}
        onDismiss={
          onDismiss &&
          (() => {
            for (const suggestion of group) {
              onDismiss(suggestion);
            }
          })
        }
      />
    );
  });
  const contributorRows = suggestions
    .filter((suggestion) => suggestion.isContributor)
    .map((suggestion) => {
      const { value, preview } = format(suggestion);
      const candidateCardId = suggestion.candidate.candidateCardId;
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
