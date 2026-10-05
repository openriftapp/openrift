import { imageUrl } from "@openrift/shared/image-url";
import type { Key, ReactNode } from "react";
import { useState } from "react";

import { ShowMoreButton } from "@/components/show-more-button";
import { Card } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { RankBand, rankBandRingClass, rankBandTone } from "@/components/ui/rank-band";
import { cn } from "@/lib/utils";

const TILES_SHOWN = 8;

export function LegendFinishTile({
  rank,
  rankText,
  rankLabel,
  imageId,
  identity,
  player,
  detail,
  action,
}: {
  rank: number;
  rankText: string;
  rankLabel?: string | null;
  imageId: string | null;
  identity: ReactNode;
  player: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card
      size="sm"
      className={cn("h-full gap-0 py-0", rankBandRingClass(rankBandTone(rank, true)))}
    >
      <RankBand layout="inline" rank={rank} text={rankText} label={rankLabel} />
      <div className="flex items-stretch gap-3 p-3">
        {imageId === null ? null : (
          <ImgWithFallback
            src={imageUrl(imageId, "240w")}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            fallback={null}
            className="aspect-card w-13 shrink-0 self-center rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          {identity}
          <div className="flex min-w-0 items-end justify-between gap-2 text-xs leading-tight">
            <div className="flex min-w-0 flex-col">
              <span className="min-w-0 truncate font-medium">{player}</span>
              {detail === undefined || detail === null ? null : (
                <span className="text-muted-foreground tabular-nums">{detail}</span>
              )}
            </div>
            {action === undefined || action === null ? null : (
              <span className="shrink-0 font-medium">{action}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LegendFinishGrid<T>({
  heading,
  items,
  getKey,
  renderTile,
  className,
}: {
  heading: ReactNode;
  items: readonly T[];
  getKey: (item: T) => Key;
  renderTile: (item: T) => ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, TILES_SHOWN);
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {heading}
        {items.length > TILES_SHOWN ? (
          <ShowMoreButton
            placement="heading"
            count={items.length}
            expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          />
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((item) => (
          <li key={getKey(item)}>{renderTile(item)}</li>
        ))}
      </ul>
    </section>
  );
}
