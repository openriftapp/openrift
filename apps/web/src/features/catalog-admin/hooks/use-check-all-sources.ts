import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import {
  useCheckAllCandidateCards,
  useCheckAllCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { collectReviewCheckTargets } from "@/features/admin/hooks/use-card-review-navigation";
import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";
import { compareScope } from "@/features/catalog-admin/hooks/use-compare-actions";

export function useCheckAllSources(cardSlug: string) {
  const scope = compareScope(cardSlug);
  const checkAllCardSources = useCheckAllCandidateCards(scope);
  const checkAllCandidatePrintings = useCheckAllCandidatePrintings(scope);

  async function run(detail: AdminCardDetailResponse): Promise<boolean> {
    const card = detail.card;
    if (card === null) {
      return false;
    }
    const targets = collectReviewCheckTargets(
      detail.sources,
      detail.printings,
      detail.candidatePrintings,
      buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings),
    );

    const jobs: Promise<unknown>[] = [];
    if (targets.cardSources) {
      jobs.push(checkAllCardSources.mutateAsync(card.id));
    }
    for (const printingId of targets.printingIds) {
      jobs.push(checkAllCandidatePrintings.mutateAsync({ printingId }));
    }
    for (const extraIds of targets.extraCandidateIds) {
      jobs.push(checkAllCandidatePrintings.mutateAsync({ extraIds }));
    }

    try {
      await Promise.all(jobs);
    } catch {
      return false;
    }
    return true;
  }

  return {
    run,
    isPending: checkAllCardSources.isPending || checkAllCandidatePrintings.isPending,
  };
}
