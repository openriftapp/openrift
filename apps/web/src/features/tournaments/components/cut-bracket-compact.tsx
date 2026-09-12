import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodMemberResponse,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { accentGlow, Medal } from "@/components/ui/podium";
import { SectionHeading } from "@/components/ui/section-heading";
import type { BracketMatch } from "@/features/tournaments/lib/cut-bracket-display";
import { buildBracketColumns } from "@/features/tournaments/lib/cut-bracket-display";
import { cutMatchShortLabel } from "@/features/tournaments/lib/group-cut-display";
import { groupLabelByPlayer, isWalkoverPod } from "@/features/tournaments/lib/group-cut-units";
import type { PlayerLegend } from "@/features/tournaments/lib/player-run";
import { legendsByPlayer } from "@/features/tournaments/lib/player-run";
import { pairingLabel } from "@/features/tournaments/lib/tournament-display";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { TournamentLegend } from "./tournament-legend";

const FINAL_GLOW = accentGlow(12);

interface SeatContext {
  cutSize: CutSize;
  seedByPlayer: Map<string, number>;
  legendByPlayer: Map<string, PlayerLegend>;
  groupByPlayer: Map<string, string>;
  placeByPlayer: Map<string, number>;
}

function isHigherSeed(pod: PodResponse, playerId: string, seedByPlayer: Map<string, number>) {
  const seeds = pod.members.flatMap((member) => {
    const seed = seedByPlayer.get(member.playerId);
    return seed === undefined ? [] : [seed];
  });
  const own = seedByPlayer.get(playerId);
  return own !== undefined && seeds.length > 0 && own === Math.min(...seeds);
}

function Seat({
  member,
  pod,
  context,
}: {
  member: PodMemberResponse;
  pod: PodResponse;
  context: SeatContext;
}) {
  const winner = member.placement === 1;
  const place = context.placeByPlayer.get(member.playerId);
  const seed = context.seedByPlayer.get(member.playerId);
  const legend = context.legendByPlayer.get(member.playerId);
  const group = context.groupByPlayer.get(member.playerId);
  const open = pod.resultStatus !== "reported";
  const chooser = open && isHigherSeed(pod, member.playerId, context.seedByPlayer);
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 text-sm not-last:border-b",
        winner ? "font-semibold" : "text-muted-foreground",
      )}
    >
      {place !== undefined && place <= 3 ? (
        <Medal rank={place} />
      ) : (
        <Badge variant="outline" className="w-8 shrink-0 justify-center tabular-nums">
          {seed === undefined ? "–" : `#${seed}`}
        </Badge>
      )}
      <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
      {group ? (
        <Badge variant="muted" className="shrink-0">
          {group}
        </Badge>
      ) : null}
      {chooser ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          {m.tournaments_cut_chooses_starter()}
        </span>
      ) : null}
      {legend ? (
        <TournamentLegend
          legendCardId={legend.legendCardId}
          legendName={legend.legendName}
          championOnly
          className="text-muted-foreground hidden shrink-0 text-xs sm:flex"
        />
      ) : null}
      <span className="font-heading w-6 text-right tabular-nums">
        {isWalkoverPod(pod) ? (winner ? "W" : "–") : (member.gamePoints ?? "–")}
      </span>
    </div>
  );
}

function EmptySeat({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex items-center px-3 py-2.5 text-sm not-last:border-b">
      {label}
    </div>
  );
}

function PodSeats({ pod, context }: { pod: PodResponse; context: SeatContext }) {
  return (
    <>
      {pod.members.map((member) => (
        <Seat key={member.playerId} member={member} pod={pod} context={context} />
      ))}
    </>
  );
}

function Match({
  match,
  roundNumber,
  context,
  isFinal,
}: {
  match: BracketMatch;
  roundNumber: number;
  context: SeatContext;
  isFinal: boolean;
}) {
  return (
    <Card
      className={cn("gap-0 py-0", isFinal && "ring-border-accent/50")}
      style={isFinal ? { backgroundImage: FINAL_GLOW } : undefined}
    >
      <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs font-semibold">
        <span>{cutMatchShortLabel(context.cutSize, roundNumber, match.podNumber)}</span>
        <span className="font-normal">{pairingLabel(match.podNumber)}</span>
      </div>
      {match.pod === null ? (
        (
          match.feeders ?? [m.tournaments_cut_not_drawn_yet(), m.tournaments_cut_not_drawn_yet()]
        ).map((feeder, index) => (
          <EmptySeat
            key={`${match.key}:${index}`}
            label={match.feeders ? m.tournaments_cut_winner_of({ match: feeder }) : feeder}
          />
        ))
      ) : (
        <PodSeats pod={match.pod} context={context} />
      )}
    </Card>
  );
}

export function CutBracketCompact({
  rounds,
  cutSize,
  groupStage,
}: {
  rounds: PodRoundResponse[];
  cutSize: CutSize;
  groupStage: GroupStageView;
}) {
  const columns = buildBracketColumns(rounds, cutSize);
  if (!groupStage.cutGenerated) {
    return null;
  }
  const context: SeatContext = {
    cutSize,
    groupByPlayer: groupLabelByPlayer(groupStage.groups),
    seedByPlayer: new Map(
      groupStage.ranking.flatMap((row) => (row.seed === null ? [] : [[row.playerId, row.seed]])),
    ),
    legendByPlayer: legendsByPlayer(groupStage),
    placeByPlayer: new Map(
      (groupStage.finalStandings ?? []).map((row) => [row.playerId, row.place] as const),
    ),
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{m.tournaments_cut_top_heading({ size: cutSize })}</SectionHeading>
      {/* flex-col-reverse renders the rounds final-first on phones without duplicate markup. */}
      <div
        className="flex flex-col-reverse gap-4 lg:grid lg:gap-5"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column, index) => (
          <div key={column.roundNumber} className="flex flex-col justify-center gap-2.5">
            <span className="text-muted-foreground text-xs font-semibold">{column.label}</span>
            {column.matches.map((match) => (
              <Match
                key={match.key}
                match={match}
                roundNumber={column.roundNumber}
                context={context}
                isFinal={index === columns.length - 1}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
