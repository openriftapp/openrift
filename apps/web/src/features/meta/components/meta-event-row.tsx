import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaEventFinish, MetaEventSummary } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import { CountryFlag } from "@/components/ui/country-flag";
import { DateLeaf } from "@/components/ui/date-leaf";
import { RankBand } from "@/components/ui/rank-band";
import { RowListLink } from "@/components/ui/row-list";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank, metaEventCounts } from "@/features/meta/lib/meta-format";
import { metaEventWinners } from "@/features/meta/lib/meta-front-page";
import { cn } from "@/lib/utils";

/** Full width by design: a caller placing content beside the standings below must not squeeze this. */
export function MetaEventHeading({
  event,
  showTier = false,
}: {
  event: MetaEventSummary;
  showTier?: boolean;
}) {
  const venue = [event.organizer, event.location].filter(Boolean).join(" · ");
  const counts = metaEventCounts(event);

  return (
    <span className="flex items-center gap-3">
      <DateLeaf at={event.eventDate} clock="utc" size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{event.name}</span>
        <span className="text-muted-foreground truncate text-xs">{venue}</span>
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          {showTier && <MetaTierBadge tier={event.tier} />}
          <CountryFlag code={event.country} size="sm" />
          <span className="truncate tabular-nums">{counts.join(" · ")}</span>
        </span>
      </span>
      <ChevronRightIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </span>
  );
}

/** No winner-row fill: the crown and bold name already mark it, and a fill would look like hover. */
export function MetaFinishRow({
  finish,
  showArt = false,
}: {
  finish: MetaEventFinish;
  showArt?: boolean;
}) {
  const record = formatRecord(finish.wins, finish.losses, finish.draws);

  return (
    <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1">
      <RankBand
        rank={finish.rank}
        text={formatRank(finish.rank, finish.rankIsTier)}
        filled={false}
        crownOnly
        className="w-12 shrink-0 rounded-md"
      />
      {showArt && (
        <CardArtThumb
          imageId={finish.legend?.imageId ?? null}
          domains={finish.legend?.domains}
          loading="lazy"
          className="h-12"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", finish.rank === 1 ? "font-semibold" : "font-medium")}>
          {finish.playerName}
        </span>
        <MetaIdentity legend={finish.legend} domains={finish.legend?.domains} className="text-sm" />
      </span>
      {record !== null && (
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {record}
        </span>
      )}
    </span>
  );
}

/**
 * A tie prints one row per winner: picking a single one to stand for a shared
 * win would print a fact nobody published.
 */
export function MetaEventRow({ event }: { event: MetaEventSummary }) {
  const winners = metaEventWinners(event);

  return (
    <RowListLink
      render={<Link to="/meta/$slug" params={{ slug: event.slug }} />}
      className="flex-col items-stretch gap-1.5 py-2.5"
    >
      <MetaEventHeading event={event} />
      {winners.length > 0 && (
        <span className="flex flex-col gap-0.5 sm:pl-12">
          {winners.map((finish, index) => (
            <MetaFinishRow key={`${finish.rank}-${finish.playerName}-${index}`} finish={finish} />
          ))}
        </span>
      )}
    </RowListLink>
  );
}
