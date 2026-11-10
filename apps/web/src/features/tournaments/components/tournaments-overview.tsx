import type { TournamentSummaryResponse } from "@openrift/shared/types/api/tournament";

import { Heading } from "@/components/heading";
import { ShowMoreButton } from "@/components/show-more-button";
import { NextEventHero } from "@/features/tournaments/components/next-event-hero";
import { PastEventsTimeline } from "@/features/tournaments/components/past-events-timeline";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import {
  compareTournamentsForList,
  partitionTournaments,
} from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

function UpcomingGrid({ tournaments }: { tournaments: TournamentSummaryResponse[] }) {
  return (
    <ul className="grid gap-3">
      {tournaments.map((tournament) => (
        <li key={tournament.id}>
          <TournamentCard tournament={tournament} />
        </li>
      ))}
    </ul>
  );
}

interface PastPaging {
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

interface TournamentsOverviewProps {
  tournaments: TournamentSummaryResponse[];
  noUpcomingText: string;
  showContext?: boolean;
  pastPaging?: PastPaging;
}

export function TournamentsOverview({
  tournaments,
  noUpcomingText,
  showContext = false,
  pastPaging,
}: TournamentsOverviewProps) {
  const { current, pastOrArchived } = partitionTournaments(tournaments);
  const [hero, ...alsoUpcoming] = current.toSorted((a, b) => compareTournamentsForList(a, b));
  const pastSorted = pastOrArchived.toSorted((a, b) => compareTournamentsForList(a, b));
  const hasMorePast = pastPaging?.hasMore ?? false;
  const pastTotal = hasMorePast
    ? Math.max(pastPaging?.total ?? 0, pastSorted.length)
    : pastSorted.length;

  function handleLoadMorePast() {
    pastPaging?.onLoadMore();
  }

  return (
    <div className="flex flex-col gap-7">
      {hero ? (
        <NextEventHero tournament={hero} showContext={showContext} />
      ) : (
        <p className="text-muted-foreground">{noUpcomingText}</p>
      )}
      {alsoUpcoming.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Heading>{m.tournaments_overview_also_coming_up()}</Heading>
          <UpcomingGrid tournaments={alsoUpcoming} />
        </section>
      ) : null}
      {pastSorted.length > 0 || hasMorePast ? (
        <section className="flex flex-col gap-3">
          <Heading>
            {m.tournaments_overview_past_events()}
            <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
              {pastTotal}
            </span>
          </Heading>
          <PastEventsTimeline tournaments={pastSorted} showContext={showContext} />
          {pastPaging && hasMorePast ? (
            <ShowMoreButton pending={pastPaging.loadingMore} onClick={handleLoadMorePast}>
              {m.tournaments_overview_show_older_events()}
            </ShowMoreButton>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
