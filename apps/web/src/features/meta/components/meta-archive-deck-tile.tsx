import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { Medal } from "@/components/ui/podium";
import { FannedPreview } from "@/features/decks/components/deck-tile";
import { MetaDeckFrame, metaFrontImage } from "@/features/meta/components/meta-deck-card";
import { MetaDeckOwnedBar } from "@/features/meta/components/meta-deck-owned-bar";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaListShapeBar } from "@/features/meta/components/meta-list-shape-bar";
import { MetaListStatusBadge } from "@/features/meta/components/meta-list-status-badge";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { formatRank, MEDAL_RANKS, metaDeckLinkLabel } from "@/features/meta/lib/meta-format";
import { eitherName } from "@/features/meta/lib/meta-inferred";
import { compactFormatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// The artwork under the plate ignores the theme, so the plate does too.
const PLATE_CLASS = "absolute rounded-full bg-black/60 text-xs font-medium text-white tabular-nums";

function PlacementPlate({ deck, fieldSize }: { deck: MetaDeckSummary; fieldSize?: number }) {
  const field =
    fieldSize === undefined ? null : <span>{m.meta_deck_of_field({ count: fieldSize })}</span>;
  if (deck.rank <= MEDAL_RANKS) {
    return (
      <span
        className={cn(PLATE_CLASS, "bottom-2 left-2 flex items-center gap-1.5 py-0.5 pr-2 pl-1")}
      >
        <Medal rank={deck.rank} variant="onArt" fill={false} />
        {field}
      </span>
    );
  }
  return (
    <span className={cn(PLATE_CLASS, "bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5")}>
      <span className="font-heading font-bold">{formatRank(deck.rank, deck.rankIsTier)}</span>
      {field}
    </span>
  );
}

export function MetaArchiveDeckTile({
  deck,
  cost,
  fieldSize,
  marketplace,
  showEvent = false,
}: {
  deck: MetaDeckSummary;
  cost?: MetaDeckCost;
  fieldSize?: number;
  marketplace: Marketplace;
  showEvent?: boolean;
}) {
  const record = formatRecord(deck.wins, deck.losses, deck.draws);
  const value = cost?.value;
  const unpriced = cost?.unpriced ?? 0;

  return (
    <MetaDeckFrame
      deck={deck}
      label={metaDeckLinkLabel(deck)}
      className="flex flex-col overflow-hidden"
    >
      <div className="relative">
        <FannedPreview
          legendImage={metaFrontImage(deck.legendImageId)}
          championImage={metaFrontImage(deck.championImageId ?? deck.inferredChampionImageId)}
          championGuess={
            deck.championImageId === null && eitherName(deck.inferredChampionNames) !== null
              ? m.meta_inferred_champion_title({
                  name: eitherName(deck.inferredChampionNames) ?? "",
                })
              : undefined
          }
          soloLegend
        />
        <PlacementPlate deck={deck} fieldSize={fieldSize} />
        {value !== undefined && (value > 0 || unpriced > 0) && (
          <span className={cn(PLATE_CLASS, "top-2 right-2 px-2 py-0.5")}>
            {value > 0 && compactFormatterForMarketplace(marketplace)(value)}
            {unpriced > 0 && ` ${m.common_unpriced({ count: unpriced })}`}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <MetaIdentity
          legend={{ character: deck.legendCharacter, epithet: deck.legendEpithet }}
          archiveSlug={deck.legendArchiveSlug}
          layout="tile"
        />

        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
          <MetaPlayerName
            name={deck.playerName}
            playerKey={deck.playerKey}
            inStretchedTile
            className="truncate font-medium"
          />
          {record !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">{record}</span>
          )}
          <MetaListStatusBadge listStatus={deck.listStatus} />
          {deck.listShape !== null && <MetaListShapeBar shape={deck.listShape} />}
        </p>

        {showEvent && (
          <p className="mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-xs">
            <MetaTierBadge tier={deck.event.tier} />
            <span className="text-muted-foreground truncate">{deck.event.name}</span>
          </p>
        )}

        <MetaDeckOwnedBar cost={cost} marketplace={marketplace} className="mt-auto pt-1" />
      </div>
    </MetaDeckFrame>
  );
}
