import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";

import type {
  CandidatePrintingFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CardAttentionNewPrintings } from "@/features/admin/components/card-attention-new-printings";
import { unknownOptionValues } from "@/features/admin/components/card-detail-shared";
import { SourceBlock } from "@/features/admin/components/source-block";
import { SubmissionBlock } from "@/features/admin/components/submission-block";
import { useReviewQueueWhen } from "@/features/admin/hooks/use-catalog-review";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import {
  attentionCount,
  buildAttentionSources,
  buildAttentionSubmissions,
} from "@/features/admin/lib/attention-items";

export function CardAttentionSection({
  detail,
  cardSlug,
  compareAction,
  onOpenNewPrinting,
  printingFields,
  providerLabels,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
  compareAction: ReactNode;
  onOpenNewPrinting: (candidatePrintingId: string) => void;
  printingFields: FieldDef<CandidatePrintingFieldKey>[];
  providerLabels: Record<string, string>;
}) {
  const { data: providerSettingsData } = useProviderSettings();
  const submissions = buildAttentionSubmissions(detail);
  const sources = buildAttentionSources(detail, providerSettingsData.providerSettings);
  const { data: queue } = useReviewQueueWhen(submissions.length > 0);

  if (attentionCount(submissions, sources) === 0) {
    return null;
  }

  // The accept endpoint refuses a printing whose values are not on an admin list.
  const blockedNewPrintings = new Map<string, string>();
  for (const submission of submissions) {
    for (const group of submission.groups) {
      if (group.kind !== "new-printing" || group.candidate === null) {
        continue;
      }
      const unknown = unknownOptionValues([group.candidate], printingFields, providerLabels);
      if (unknown.length > 0) {
        blockedNewPrintings.set(
          group.candidate.id,
          unknown
            .map((entry) => `${entry.label} “${entry.value}” is not on the admin list`)
            .join(", "),
        );
      }
    }
  }

  return (
    <section className="space-y-4">
      {submissions.map((submission) => (
        <SubmissionBlock
          key={submission.candidateCardId}
          detail={detail}
          submission={submission}
          scope={{ cardSlug }}
          queueItem={queue?.items.find(
            (item) => item.candidateCardId === submission.candidateCardId,
          )}
          onOpenNewPrinting={onOpenNewPrinting}
          blockedNewPrintings={blockedNewPrintings}
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
          compareAction={compareAction}
          unlinkedSlot={
            <CardAttentionNewPrintings
              detail={detail}
              candidateCardId={source.candidateCardId}
              onOpen={onOpenNewPrinting}
            />
          }
        />
      ))}
    </section>
  );
}
