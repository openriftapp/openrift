import { imageUrl } from "@openrift/shared/image-url";
import type {
  MetaEventMatch,
  MetaEventPhase,
  MetaEventPlayer,
} from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";
import { TextLink } from "@/components/ui/text-link";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { cutSizeOf } from "@/features/meta/lib/meta-event-structure";
import { finishBracketLabel, formatRank, formatRecord } from "@/features/meta/lib/meta-format";
import type { MetaLegendBestFinish } from "@/features/meta/lib/meta-player-run";
import { metaBestFinishPerLegend } from "@/features/meta/lib/meta-player-run";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const TILES_SHOWN = 8;

function LegendFinishTile({
  entry,
  eventSlug,
  cutSize,
}: {
  entry: MetaLegendBestFinish;
  eventSlug: string | undefined;
  cutSize: number | null;
}) {
  const { legend, player } = entry;
  const record = formatRecord(player.wins, player.losses, player.draws);

  return (
    <Card
      size="sm"
      className={cn("h-full gap-0 py-0", rankBandRingClass(rankBandTone(player.rank, true)))}
    >
      <RankBand
        layout="inline"
        rank={player.rank}
        text={formatRank(player.rank, player.rankIsTier)}
        label={finishBracketLabel(player.rank, player.rankIsTier, cutSize)}
      />
      <div className="flex items-stretch gap-3 p-3">
        {legend.imageId !== null && (
          <ImgWithFallback
            src={imageUrl(legend.imageId, "240w")}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            fallback={null}
            className="aspect-card w-13 shrink-0 self-center rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          <MetaIdentity
            name={legend.name}
            slug={legend.slug}
            archiveSlug={legend.archiveSlug}
            domains={legend.domains}
            layout="tile"
          />
          <div className="flex min-w-0 items-end justify-between gap-2 text-xs leading-tight">
            <div className="flex min-w-0 flex-col">
              <MetaPlayerName
                name={player.playerName}
                playerKey={player.playerKey}
                eventSlug={eventSlug}
                className="min-w-0 truncate font-medium"
              />
              {record !== null && (
                <span className="text-muted-foreground tabular-nums">{record}</span>
              )}
            </div>
            {player.shareToken !== null && (
              <TextLink
                className="shrink-0 font-medium"
                render={<Link to="/meta/decks/$token" params={{ token: player.shareToken }} />}
              >
                {m.meta_legend_finishes_deck()}
              </TextLink>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MetaEventLegendFinishes({
  players,
  matches,
  phases,
  slug,
}: {
  players: readonly MetaEventPlayer[];
  matches: readonly MetaEventMatch[];
  phases: readonly MetaEventPhase[];
  slug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = metaBestFinishPerLegend(players);
  const playersWithRun = new Set(matches.flatMap((match) => [match.player1Id, match.player2Id]));
  const cutSize = cutSizeOf(phases);

  if (entries.length === 0) {
    return null;
  }

  const shown = expanded ? entries : entries.slice(0, TILES_SHOWN);

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading>{m.meta_legend_finishes_best_per_legend()}</Heading>
        {entries.length > TILES_SHOWN && (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? m.meta_show_fewer()
              : m.meta_show_all_n({ count: entries.length.toLocaleString("en-US") })}
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((entry) => (
          <li key={entry.legend.cardId}>
            <LegendFinishTile
              entry={entry}
              eventSlug={playersWithRun.has(entry.player.id) ? slug : undefined}
              cutSize={cutSize}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
