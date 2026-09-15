import { formatDay } from "@openrift/shared/format-date";
import { imageUrl } from "@openrift/shared/image-url";
import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";
import { TextLink } from "@/components/ui/text-link";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { finishBracketLabel, formatRank, formatRecord } from "@/features/meta/lib/meta-format";
import { cn } from "@/lib/utils";
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
    <Card
      size="sm"
      className={cn("h-full gap-0 py-0", rankBandRingClass(rankBandTone(deck.rank, true)))}
    >
      <RankBand
        layout="inline"
        rank={deck.rank}
        text={formatRank(deck.rank, deck.rankIsTier)}
        label={finishBracketLabel(deck.rank, deck.rankIsTier, null)}
      />
      <div className="flex items-stretch gap-3 p-3">
        {deck.legendImageId !== null && (
          <ImgWithFallback
            src={imageUrl(deck.legendImageId, "240w")}
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
            name={deck.legendName}
            slug={deck.legendSlug}
            archiveSlug={deck.legendArchiveSlug}
            domains={legendDomains}
            layout="tile"
          />
          <div className="flex min-w-0 items-end justify-between gap-2 text-xs leading-tight">
            <div className="flex min-w-0 flex-col">
              <TextLink
                variant="inherit"
                className="min-w-0 truncate font-medium"
                render={<Link to="/meta/$slug" params={{ slug: deck.event.slug }} />}
              >
                {deck.event.name}
              </TextLink>
              <span className="text-muted-foreground truncate tabular-nums">
                {facts.join(" · ")}
              </span>
            </div>
            <TextLink
              className="shrink-0 font-medium"
              render={<Link to="/meta/decks/$token" params={{ token: deck.shareToken }} />}
            >
              {m.meta_legend_finishes_deck()}
            </TextLink>
          </div>
        </div>
      </div>
    </Card>
  );
}
