import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { MetaSubmitPage } from "@/features/meta/components/meta-submit-page";
import { metaDeckQueryOptions } from "@/features/meta/lib/meta-queries";
import { metaSubmissionTextFromCards } from "@/features/meta/lib/meta-submission-form";

const routeApi = getRouteApi("/_app/_authenticated/meta_/$slug_/submit");

export function MetaEventSubmitPage() {
  const { slug } = routeApi.useParams();
  const search = routeApi.useSearch();
  const token = search.deck;
  const { data: archived } = useQuery({
    ...metaDeckQueryOptions(token ?? ""),
    enabled: token !== undefined,
  });

  return (
    <MetaSubmitPage
      slug={slug}
      prefill={{
        kind: search.ask,
        metaEventPlayerId: search.playerId,
        playerName: search.player,
        rank: search.rank,
        rankIsTier: search.cut,
        wins: search.wins,
        losses: search.losses,
        draws: search.draws,
        legendName: search.legend,
        legendCardId: search.legendId,
        deckText: archived ? metaSubmissionTextFromCards(archived.cards) : undefined,
      }}
    />
  );
}
