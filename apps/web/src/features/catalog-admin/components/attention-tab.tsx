import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import { Badge } from "@/components/ui/badge";
import { CardList } from "@/components/ui/card-list";
import { useSubmissionForCandidate } from "@/features/admin/hooks/use-admin-card-submissions";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { SourceBlock } from "@/features/catalog-admin/components/source-block";
import { SubmissionBlock } from "@/features/catalog-admin/components/submission-block";
import { useReviewQueue } from "@/features/catalog-admin/hooks/use-catalog-review";
import {
  buildAttentionSources,
  buildAttentionSubmissions,
} from "@/features/catalog-admin/lib/attention-items";
import { submissionStatusLabels } from "@/features/contribute/lib/card-submission-copy";

function SettledRow({
  candidateCardId,
  submitterName,
}: {
  candidateCardId: string;
  submitterName: string | null;
}) {
  const { data } = useSubmissionForCandidate(candidateCardId);
  const submission = data?.submission ?? null;

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{submitterName ?? "Contributor"}</span>
      <Badge variant={submission?.status === "accepted" ? "success" : "muted"}>
        {submission ? submissionStatusLabels[submission.status] : "Checked"}
      </Badge>
    </li>
  );
}

export function AttentionTab({
  detail,
  cardSlug,
  onSettled,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
  onSettled: () => void;
}) {
  const { data: providerSettingsData } = useProviderSettings();
  const { data: queue } = useReviewQueue();

  const submissions = buildAttentionSubmissions(detail);
  const sources = buildAttentionSources(detail, providerSettingsData.providerSettings);
  const settledSources = detail.sources.filter(
    (source) => source.provider === USER_SUBMISSION_PROVIDER && source.checkedAt !== null,
  );

  return (
    <div className="space-y-4">
      {submissions.length === 0 && sources.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing needs a decision on this card. Disagreement between sources lives on Compare.
        </p>
      )}

      {submissions.map((submission) => (
        <SubmissionBlock
          key={submission.candidateCardId}
          detail={detail}
          submission={submission}
          scope={{ cardSlug }}
          queueItem={queue?.items.find(
            (item) => item.candidateCardId === submission.candidateCardId,
          )}
          onSettled={onSettled}
        />
      ))}

      {sources.map((source) => (
        <SourceBlock
          key={source.candidateCardId}
          detail={detail}
          provider={source.provider}
          candidateCardId={source.candidateCardId}
          changedFields={source.changedFields}
          newPrintings={source.newPrintings}
          cardSlug={cardSlug}
        />
      ))}

      {settledSources.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-medium">Recently settled</h3>
          <CardList>
            {settledSources.map((source) => (
              <SettledRow
                key={source.id}
                candidateCardId={source.id}
                submitterName={source.submittedByName}
              />
            ))}
          </CardList>
        </section>
      )}
    </div>
  );
}
