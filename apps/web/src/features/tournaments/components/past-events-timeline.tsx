import type {
  TournamentSummaryResponse,
  TournamentWinner,
} from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { DateLeaf } from "@/components/ui/date-leaf";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { ParticipantFacepile } from "@/features/tournaments/components/participant-facepile";
import { TournamentMetaLine } from "@/features/tournaments/components/tournament-meta-line";
import {
  effectiveStateLabels,
  tournamentContextLabel,
} from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

function WinnerChip({ winner }: { winner: TournamentWinner }) {
  return (
    <span className="border-border-accent/40 bg-border-accent/10 flex shrink-0 items-center gap-2 rounded-md border py-1 pr-2.5 pl-2">
      <TrophyIcon className="text-border-accent size-3.5 shrink-0" aria-hidden="true" />
      {winner.legendImageId ? (
        <CardArtThumb shape="strip" imageId={winner.legendImageId} className="h-7" />
      ) : null}
      <span className="text-sm">
        <span className="sr-only">{m.tournaments_past_events_winner_label()}</span>
        <span className="font-medium">{winner.name}</span>
      </span>
    </span>
  );
}

function PastEventCard({
  tournament,
  showContext,
}: {
  tournament: TournamentSummaryResponse;
  showContext: boolean;
}) {
  return (
    <CardLink render={<Link to="/tournaments/$id" params={{ id: tournament.id }} />}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-medium">{tournament.name}</span>
            {tournament.status === "cancelled" ? (
              <Badge variant="neutral">{effectiveStateLabels().cancelled}</Badge>
            ) : null}
            {showContext && tournamentContextLabel(tournament) ? (
              <Badge variant="outline" className="max-sm:hidden">
                {tournamentContextLabel(tournament)}
              </Badge>
            ) : null}
          </span>
          <TournamentMetaLine tournament={tournament} className="text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {tournament.winner ? <WinnerChip winner={tournament.winner} /> : null}
          <ParticipantFacepile
            preview={tournament.participantPreview}
            totalCount={tournament.participantCount}
            size="sm"
            className="max-sm:hidden"
          />
        </div>
      </CardContent>
    </CardLink>
  );
}

export function PastEventsTimeline({
  tournaments,
  showContext = false,
}: {
  tournaments: TournamentSummaryResponse[];
  showContext?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {tournaments.map((tournament) => (
        <li
          key={tournament.id}
          className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3"
        >
          <DateLeaf at={tournament.startsAt} clock="local" size="sm" className="mt-2" />
          <PastEventCard tournament={tournament} showContext={showContext} />
        </li>
      ))}
    </ul>
  );
}
