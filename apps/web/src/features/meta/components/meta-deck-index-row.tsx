import { formatDay } from "@openrift/shared/format-date";
import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { Link } from "@tanstack/react-router";

import { CountryFlag } from "@/components/ui/country-flag";
import { DateLeaf } from "@/components/ui/date-leaf";
import { RankBand } from "@/components/ui/rank-band";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaListShapeBar } from "@/features/meta/components/meta-list-shape-bar";
import { MetaListStatusBadge } from "@/features/meta/components/meta-list-status-badge";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { formatRank } from "@/features/meta/lib/meta-format";
import { eitherName } from "@/features/meta/lib/meta-inferred";
import { compactFormatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Shared by the rows and the sort header above them; keep both in sync.
export function deckIndexGrid(grouped: boolean, withCollection: boolean): string {
  if (grouped) {
    return withCollection
      ? "grid grid-cols-[4.5rem_2.75rem_minmax(0,1fr)_minmax(0,1fr)_4rem_10.5rem] items-center gap-x-3.5"
      : "grid grid-cols-[4.5rem_2.75rem_minmax(0,2fr)_minmax(0,3fr)_4rem] items-center gap-x-3.5";
  }
  return withCollection
    ? "grid grid-cols-[4.5rem_2.75rem_11rem_10rem_minmax(0,1fr)_2.75rem_4rem_10.5rem] items-center gap-x-3.5"
    : "grid grid-cols-[4.5rem_2.75rem_11rem_minmax(0,2fr)_minmax(0,1fr)_2.75rem_4rem] items-center gap-x-3.5";
}

function Finish({ deck, fieldSize }: { deck: MetaDeckSummary; fieldSize: number | null }) {
  return (
    <RankBand
      rank={deck.rank}
      text={formatRank(deck.rank, deck.rankIsTier)}
      label={fieldSize === null ? null : m.meta_deck_of_field({ count: fieldSize })}
      filled={false}
      className="w-18 shrink-0"
    />
  );
}

function Art({ deck }: { deck: MetaDeckSummary }) {
  const guessed = deck.championImageId === null ? deck.inferredChampionImageId : null;
  const guessedName = eitherName(deck.inferredChampionNames);
  const second = deck.championImageId ?? guessed;
  return (
    <span className="relative block h-10 w-11">
      <CardArtThumb
        imageId={deck.legendImageId}
        variant="120w"
        className={cn(
          "absolute top-0 left-0 w-6.5 -rotate-6 rounded-xs shadow-sm",
          second === null && "left-2 -rotate-3",
        )}
      />
      {second !== null && (
        <CardArtThumb
          imageId={second}
          variant="120w"
          className={cn(
            "absolute top-0.5 left-4 w-6.5 rotate-6 rounded-xs shadow-sm",
            guessed !== null &&
              "outline-primary opacity-70 outline-[1.5px] -outline-offset-[1.5px] outline-dashed",
          )}
        />
      )}
      {guessed !== null && guessedName !== null && (
        <span className="sr-only">{m.meta_inferred_champion_title({ name: guessedName })}</span>
      )}
    </span>
  );
}

function Owned({ cost, marketplace }: { cost?: MetaDeckCost; marketplace: Marketplace }) {
  if (cost === undefined || cost.owned === undefined || cost.needed === 0) {
    return null;
  }
  const complete = cost.owned >= cost.needed;
  const percent = Math.min(100, Math.round((cost.owned / cost.needed) * 100));
  return (
    <span className="flex flex-col gap-1">
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
          "flex justify-between gap-1.5 text-xs whitespace-nowrap tabular-nums",
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
            <span>{m.meta_deck_owned_ratio({ owned: cost.owned, needed: cost.needed })}</span>
            {cost.toComplete !== undefined && cost.toComplete > 0 && (
              <span>
                <span className="text-foreground font-semibold">
                  {compactFormatterForMarketplace(marketplace)(cost.toComplete)}
                </span>{" "}
                {m.meta_deck_to_complete()}
              </span>
            )}
          </>
        )}
      </span>
    </span>
  );
}

function deckLabel(deck: MetaDeckSummary): string {
  return deck.legendName === null
    ? m.meta_deck_label({ player: deck.playerName })
    : m.meta_deck_label_with_legend({ player: deck.playerName, legend: deck.legendName });
}

export function MetaDeckIndexRow({
  deck,
  cost,
  fieldSize,
  marketplace,
  grouped = false,
  withCollection = true,
}: {
  deck: MetaDeckSummary;
  cost?: MetaDeckCost;
  fieldSize: number | null;
  marketplace: Marketplace;
  grouped?: boolean;
  withCollection?: boolean;
}) {
  const record = formatRecord(deck.wins, deck.losses, deck.draws);
  const value = cost?.value;
  const priced = value === undefined ? null : compactFormatterForMarketplace(marketplace)(value);

  return (
    <div className="group hover:bg-muted/50 focus-within:ring-ring/50 relative -mx-2 rounded-md px-2 py-2.5 focus-within:ring-2 focus-within:ring-inset">
      <Link
        to="/meta/decks/$token"
        params={{ token: deck.shareToken }}
        aria-label={deckLabel(deck)}
        className="outline-none after:absolute after:inset-0"
      />

      <div className={cn(deckIndexGrid(grouped, withCollection), "hidden sm:grid")}>
        <Finish deck={deck} fieldSize={grouped ? null : fieldSize} />
        <Art deck={deck} />
        <div className="min-w-0">
          <MetaIdentity
            legend={{ character: deck.legendCharacter, epithet: deck.legendEpithet }}
            archiveSlug={deck.legendArchiveSlug}
            layout="stacked"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <MetaPlayerName
              name={deck.playerName}
              playerKey={deck.playerKey}
              inStretchedTile
              className="truncate font-medium"
            />
            <MetaListStatusBadge listStatus={deck.listStatus} />
          </span>
          {(record !== null || deck.listShape !== null) && (
            <span className="flex items-center gap-2">
              {record !== null && (
                <span className="text-muted-foreground text-xs tabular-nums">{record}</span>
              )}
              {deck.listShape !== null && <MetaListShapeBar shape={deck.listShape} />}
            </span>
          )}
        </div>
        {!grouped && (
          <>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{deck.event.name}</span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MetaTierBadge tier={deck.event.tier} />
                <CountryFlag code={deck.event.country} size="sm" />
              </span>
            </div>
            <DateLeaf at={deck.event.eventDate} clock="utc" size="sm" />
          </>
        )}
        <span className="text-right text-sm tabular-nums">{priced}</span>
        {withCollection && (
          <div className="min-w-0">
            <Owned cost={cost} marketplace={marketplace} />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 sm:hidden">
        <Finish deck={deck} fieldSize={grouped ? null : fieldSize} />
        <span className="relative shrink-0">
          <CardArtThumb imageId={deck.legendImageId} variant="120w" className="w-7.5 rounded-xs" />
          {deck.championImageId === null && deck.inferredChampionImageId !== null && (
            <>
              <CardArtThumb
                imageId={deck.inferredChampionImageId}
                variant="120w"
                className="outline-primary absolute -right-1.5 -bottom-1 w-4 rounded-xs opacity-80 outline-[1.5px] -outline-offset-[1.5px] outline-dashed"
              />
              {eitherName(deck.inferredChampionNames) !== null && (
                <span className="sr-only">
                  {m.meta_inferred_champion_title({
                    name: eitherName(deck.inferredChampionNames) ?? "",
                  })}
                </span>
              )}
            </>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MetaIdentity
            legend={{ character: deck.legendCharacter, epithet: deck.legendEpithet }}
            archiveSlug={deck.legendArchiveSlug}
            layout="row"
          />
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
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
          </span>
          {!grouped && (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
              <MetaTierBadge tier={deck.event.tier} />
              <CountryFlag code={deck.event.country} size="sm" showCode={false} />
              <span className="truncate">
                {deck.event.name} · {formatDay(deck.event.eventDate)}
              </span>
            </span>
          )}
        </div>
        {cost !== undefined && (
          <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <span className="text-sm tabular-nums">{priced}</span>
            {cost.owned !== undefined && cost.needed > 0 && (
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {cost.owned >= cost.needed ? (
                  <span className="text-border-accent font-medium">{m.meta_deck_buildable()}</span>
                ) : (
                  cost.toComplete !== undefined && (
                    <>
                      <span className="text-foreground font-semibold">
                        {compactFormatterForMarketplace(marketplace)(cost.toComplete)}
                      </span>{" "}
                      {m.meta_deck_to_complete()}
                    </>
                  )
                )}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
