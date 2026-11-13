import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type { TournamentSummaryResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { TournamentMetaLine } from "@/features/tournaments/components/tournament-meta-line";
import {
  effectiveStateLabels,
  primaryViewerRole,
  viewerRoleLabels,
} from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

export function TournamentCard({ tournament }: { tournament: TournamentSummaryResponse }) {
  const role = primaryViewerRole(tournament.myRoles);
  const state = effectiveTournamentState(tournament.startsAt, tournament.endsAt, tournament.status);
  return (
    <CardLink render={<Link to="/tournaments/$id" params={{ id: tournament.id }} />}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TrophyIcon className="text-muted-foreground size-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-medium">{tournament.name}</span>
            <TournamentMetaLine tournament={tournament} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Badge variant={state === "in_progress" ? "subtle" : "secondary"}>
            {effectiveStateLabels()[state]}
          </Badge>
          {role ? <Badge variant="outline">{viewerRoleLabels()[role]}</Badge> : null}
          {tournament.host.type === "organization" ? (
            <Badge variant="outline">{tournament.host.displayName}</Badge>
          ) : null}
          {tournament.pendingRequestCount > 0 ? (
            <Badge variant="warning">
              {m.tournaments_card_pending_requests({ count: tournament.pendingRequestCount })}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </CardLink>
  );
}
