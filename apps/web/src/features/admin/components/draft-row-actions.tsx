import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { CheckIcon, LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AssignButton } from "@/features/admin/components/assign-button";
import {
  useAcceptFavoriteNewCard,
  useLinkCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { showAcceptOutcome } from "@/features/admin/lib/accept-outcome";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export function DraftRowActions({
  row,
  allCards,
}: {
  row: CandidateCardSummaryResponse;
  allCards: AdminSearchableCard[];
}) {
  const linkCard = useLinkCard();
  const acceptFavorite = useAcceptFavoriteNewCard();
  const suggested = allCards.find((card) => card.slug === row.suggestedCardSlug);
  const normalizedName = row.normalizedName;

  async function acceptAsNew() {
    let result: Awaited<ReturnType<typeof acceptFavorite.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await acceptFavorite.mutateAsync(normalizedName);
    });
    if (ok && result) {
      showAcceptOutcome(
        result.printingsCreated,
        result.skipped.map((entry) => ({ label: entry.shortCode, reason: entry.reason })),
        { subject: `Created ${result.cardSlug}` },
      );
    }
  }

  // A name with no letters or digits normalizes to "", which every one of these
  // verbs uses as its lookup key.
  if (row.normalizedName === "") {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {row.hasFavorite && (
        <Button
          variant="outline"
          size="icon-sm"
          pending={acceptFavorite.isPending}
          aria-label="Accept as a new card"
          title="Accept as a new card"
          onClick={() => void acceptAsNew()}
        >
          <CheckIcon />
        </Button>
      )}
      {suggested && (
        <Button
          variant="outline"
          size="icon-sm"
          pending={linkCard.isPending}
          aria-label={`Assign to ${suggested.slug}`}
          title={`Assign to ${suggested.slug}`}
          onClick={() =>
            linkCard.mutate({
              name: row.normalizedName,
              cardId: suggested.id,
              cardSlug: suggested.slug,
            })
          }
        >
          <LinkIcon />
        </Button>
      )}
      <AssignButton normalizedName={row.normalizedName} allCards={allCards} linkCard={linkCard} />
    </div>
  );
}
