import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { CheckIcon, LinkIcon, LoaderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AssignButton } from "@/features/admin/components/assign-button";
import {
  useAcceptFavoriteNewCard,
  useLinkCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";

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
          disabled={acceptFavorite.isPending}
          aria-label="Accept as a new card"
          title="Accept as a new card"
          onClick={() => acceptFavorite.mutate(row.normalizedName)}
        >
          {acceptFavorite.isPending ? <LoaderIcon className="animate-spin" /> : <CheckIcon />}
        </Button>
      )}
      {suggested && (
        <Button
          variant="outline"
          size="icon-sm"
          disabled={linkCard.isPending}
          aria-label={`Assign to ${suggested.slug}`}
          title={`Assign to ${suggested.slug}`}
          onClick={() => linkCard.mutate({ name: row.normalizedName, cardId: suggested.id })}
        >
          <LinkIcon />
        </Button>
      )}
      <AssignButton normalizedName={row.normalizedName} allCards={allCards} linkCard={linkCard} />
    </div>
  );
}
