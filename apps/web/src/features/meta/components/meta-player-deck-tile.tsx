import { formatDay } from "@openrift/shared/format-date";
import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { LegendFinishTile } from "@/components/deck-identity/legend-finish-tile";
import { TextLink } from "@/components/ui/text-link";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { finishBracketLabel, formatRank } from "@/features/meta/lib/meta-format";
import { m } from "@/paraglide/messages.js";

export function MetaPlayerDeckTile({
  deck,
  legendDomains,
}: {
  deck: MetaDeckSummary;
  legendDomains?: readonly string[];
}) {
  const facts = [
    formatRecord(deck.wins, deck.losses, deck.draws),
    formatDay(deck.event.eventDate),
  ].filter((fact) => fact !== null);

  return (
    <LegendFinishTile
      rank={deck.rank}
      rankText={formatRank(deck.rank, deck.rankIsTier)}
      rankLabel={finishBracketLabel(deck.rank, deck.rankIsTier, null)}
      imageId={deck.legendImageId}
      identity={
        <MetaIdentity
          legend={{ character: deck.legendCharacter, epithet: deck.legendEpithet }}
          slug={deck.legendSlug}
          archiveSlug={deck.legendArchiveSlug}
          domains={legendDomains}
          layout="tile"
        />
      }
      player={
        <TextLink
          variant="inherit"
          className="min-w-0 truncate font-medium"
          render={<Link to="/meta/$slug" params={{ slug: deck.event.slug }} />}
        >
          {deck.event.name}
        </TextLink>
      }
      detail={facts.join(" · ")}
      action={
        <TextLink render={<Link to="/meta/decks/$token" params={{ token: deck.shareToken }} />}>
          {deck.listStatus === "partial"
            ? m.meta_list_status_partial()
            : m.meta_legend_finishes_deck()}
        </TextLink>
      }
    />
  );
}
