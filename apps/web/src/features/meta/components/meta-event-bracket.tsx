import type {
  MetaEventMatch,
  MetaEventPhase,
  MetaEventPlayer,
} from "@openrift/shared/types/api/meta";

import {
  BracketColumn,
  BracketColumns,
  BracketMatchCard,
  BracketRankMark,
  BracketSeatRow,
} from "@/components/bracket/bracket";
import { Heading } from "@/components/heading";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import type { MetaBracketSeat } from "@/features/meta/lib/meta-bracket";
import { metaEventBracket } from "@/features/meta/lib/meta-bracket";
import { formatRank } from "@/features/meta/lib/meta-format";
import { m } from "@/paraglide/messages.js";

function seatName(seat: MetaBracketSeat, player: MetaEventPlayer | undefined) {
  if (player !== undefined) {
    return <MetaPlayerName name={player.playerName} playerKey={player.playerKey} />;
  }
  return seat.playerId === null ? m.meta_bracket_bye() : m.meta_bracket_unknown();
}

function Seat({ seat, player }: { seat: MetaBracketSeat; player: MetaEventPlayer | undefined }) {
  return (
    <BracketSeatRow
      winner={seat.isWinner}
      mark={
        player === undefined ? undefined : (
          <BracketRankMark rank={player.rank} text={formatRank(player.rank, player.rankIsTier)} />
        )
      }
      name={seatName(seat, player)}
      score={seat.gamesWon ?? "–"}
    >
      <MetaIdentity
        legend={player?.legend}
        championOnly
        className="text-muted-foreground hidden shrink-0 text-xs sm:flex"
      />
    </BracketSeatRow>
  );
}

export function MetaEventBracket({
  matches,
  phases,
  players,
}: {
  matches: readonly MetaEventMatch[];
  phases: readonly MetaEventPhase[];
  players: readonly MetaEventPlayer[];
}) {
  const bracket = metaEventBracket(matches, phases);
  if (bracket === null) {
    return null;
  }

  const byId = new Map(players.map((player) => [player.id, player]));

  return (
    <section className="mt-8">
      <Heading className="mb-3">{bracket.title}</Heading>
      <BracketColumns columnCount={bracket.rounds.length}>
        {bracket.rounds.map((round) => (
          <BracketColumn key={round.label} label={round.label}>
            {round.matches.map((match) => (
              <BracketMatchCard key={match.key} isFinal={round.isFinal}>
                {match.seats.map((seat, index) => (
                  <Seat
                    key={`${match.key}:${index}`}
                    seat={seat}
                    player={seat.playerId === null ? undefined : byId.get(seat.playerId)}
                  />
                ))}
              </BracketMatchCard>
            ))}
          </BracketColumn>
        ))}
      </BracketColumns>
    </section>
  );
}
