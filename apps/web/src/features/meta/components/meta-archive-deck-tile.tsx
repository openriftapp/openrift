import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { Medal } from "@/components/ui/podium";
import { FannedPreview } from "@/features/decks/components/deck-tile";
import { MetaDeckFrame, metaFrontImage } from "@/features/meta/components/meta-deck-card";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaListShapeBar } from "@/features/meta/components/meta-list-shape-bar";
import { MetaListStatusBadge } from "@/features/meta/components/meta-list-status-badge";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { formatRank, MEDAL_RANKS } from "@/features/meta/lib/meta-format";
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

function OwnedRow({ cost, marketplace }: { cost?: MetaDeckCost; marketplace: Marketplace }) {
  if (cost === undefined || cost.owned === undefined || cost.needed === 0) {
    return null;
  }
  const complete = cost.owned >= cost.needed;
  const percent = Math.min(100, Math.round((cost.owned / cost.needed) * 100));
  const toComplete = cost.toComplete;

  return (
    <div className="mt-auto flex flex-col gap-1 pt-1">
      <span
        aria-hidden
        className={cn(
          "block h-1 overflow-hidden rounded-full",
          complete ? "bg-border-accent/25" : "bg-muted",
        )}
      >
        <span
          className={cn("block h-full rounded-full", complete ? "bg-border-accent" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span
        className={cn(
          "flex flex-wrap justify-between gap-x-1.5 text-xs tabular-nums",
          complete ? "text-border-accent font-medium" : "text-muted-foreground",
        )}
      >
        {complete ? (
          <>
            <span>{m.meta_deck_all_owned({ count: String(cost.needed) })}</span>
            <span>{m.meta_deck_buildable()}</span>
          </>
        ) : (
          <>
            <span>{m.meta_deck_owned_of({ owned: cost.owned, needed: cost.needed })}</span>
            {toComplete !== undefined && toComplete > 0 && (
              <span>
                <span className="text-foreground font-semibold">
                  {compactFormatterForMarketplace(marketplace)(toComplete)}
                </span>{" "}
                {m.meta_deck_to_complete()}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

function deckLabel(deck: MetaDeckSummary): string {
  return deck.legendName === null
    ? m.meta_deck_tile_label({ player: deck.playerName })
    : m.meta_deck_tile_label_legend({ player: deck.playerName, legend: deck.legendName });
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

  return (
    <MetaDeckFrame deck={deck} label={deckLabel(deck)} className="flex flex-col overflow-hidden">
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
        {value !== undefined && (
          <span className={cn(PLATE_CLASS, "top-2 right-2 px-2 py-0.5")}>
            {compactFormatterForMarketplace(marketplace)(value)}
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

        <OwnedRow cost={cost} marketplace={marketplace} />
      </div>
    </MetaDeckFrame>
  );
}
