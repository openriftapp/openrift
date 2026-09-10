import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";

interface SourceBlockProps {
  provider: string;
  candidateCardId: string;
  changedFields: number;
  newPrintings: number;
  cardSlug: string;
  candidatePrintingIds: string[];
}

export function SourceBlock({
  provider,
  candidateCardId,
  changedFields,
  newPrintings,
  cardSlug,
  candidatePrintingIds,
}: SourceBlockProps) {
  const scope = [adminKeys.cards.detail(cardSlug), catalogAdminKeys.reviewQueue];
  const checkCard = useCheckCandidateCard(scope);
  const checkPrintings = useCheckAllCandidatePrintings(scope);
  const isPending = checkCard.isPending || checkPrintings.isPending;

  async function markChecked() {
    const jobs: Promise<unknown>[] = [checkCard.mutateAsync(candidateCardId)];
    if (candidatePrintingIds.length > 0) {
      jobs.push(checkPrintings.mutateAsync({ extraIds: candidatePrintingIds }));
    }
    try {
      await Promise.all(jobs);
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge variant="warning">Unchecked</Badge>
        <span className="font-medium">{provider} (trusted) has unchecked values for this card</span>
        <span className="text-muted-foreground text-sm">
          {changedFields} differ · {newPrintings} new printing{newPrintings === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" disabled={isPending} onClick={() => void markChecked()}>
            Mark checked
          </Button>
          <Button
            variant="ghost"
            render={
              <Link
                to="/admin/catalog/cards/$cardSlug"
                params={{ cardSlug }}
                search={{ tab: "compare" }}
              />
            }
          >
            Compare &rarr;
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
