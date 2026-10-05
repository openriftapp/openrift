import { cutSizeOf, formatRecord } from "@openrift/shared/meta-standings";
import type { MetaEventPhase, MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { LegendFinishGrid, LegendFinishTile } from "@/components/deck-identity/legend-finish-tile";
import { Heading } from "@/components/heading";
import { TextLink } from "@/components/ui/text-link";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { finishBracketLabel, formatRank } from "@/features/meta/lib/meta-format";
import { m } from "@/paraglide/messages.js";

type NamedLegendRow = MetaStandingsRow & { legend: NonNullable<MetaStandingsRow["legend"]> };

function EventLegendFinishTile({
  player,
  eventSlug,
  cutSize,
}: {
  player: NamedLegendRow;
  eventSlug: string | undefined;
  cutSize: number | null;
}) {
  const legend = player.legend;
  return (
    <LegendFinishTile
      rank={player.rank}
      rankText={formatRank(player.rank, player.rankIsTier)}
      rankLabel={finishBracketLabel(player.rank, player.rankIsTier, cutSize)}
      imageId={legend.imageId}
      identity={
        <MetaIdentity
          legend={legend}
          slug={legend.slug}
          archiveSlug={legend.archiveSlug}
          domains={legend.domains}
          layout="tile"
        />
      }
      player={
        <MetaPlayerName
          name={player.playerName}
          playerKey={player.playerKey}
          eventSlug={eventSlug}
        />
      }
      detail={formatRecord(player.wins, player.losses, player.draws)}
      action={
        player.shareToken === null ? null : (
          <TextLink render={<Link to="/meta/decks/$token" params={{ token: player.shareToken }} />}>
            {m.meta_legend_finishes_deck()}
          </TextLink>
        )
      }
    />
  );
}

export function MetaEventLegendFinishes({
  entries,
  phases,
  slug,
}: {
  entries: readonly MetaStandingsRow[];
  phases: readonly MetaEventPhase[];
  slug: string;
}) {
  const cutSize = cutSizeOf(phases);
  // The row's legend card id is composed through a left join, so a card the
  // catalogue is missing arrives as a null ref with nothing to put on a tile.
  const named = entries.filter((player): player is NamedLegendRow => player.legend !== null);

  if (named.length === 0) {
    return null;
  }

  return (
    <LegendFinishGrid
      className="mt-8"
      heading={<Heading>{m.meta_legend_finishes_best_per_legend()}</Heading>}
      items={named}
      getKey={(player) => player.legend.cardId}
      renderTile={(player) => (
        <EventLegendFinishTile
          player={player}
          eventSlug={player.rounds.length > 0 ? slug : undefined}
          cutSize={cutSize}
        />
      )}
    />
  );
}
