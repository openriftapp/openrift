import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";

import { TableCell, TableRow } from "@/components/ui/table";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import {
  DeckCell,
  DeckPreview,
  DeckValue,
  LegendCell,
  RankCell,
  RunCell,
} from "@/features/meta/components/meta-event-standings-cells";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import type { RowSlot, StandingsColumns } from "@/features/meta/lib/meta-event-standings";
import type { MetaPendingRowMark } from "@/features/meta/lib/meta-pending-submissions";
import { cn } from "@/lib/utils";

export interface RowProps extends RowSlot {
  player: MetaStandingsRow;
  slug: string;
  canSubmit: boolean;
  columns: StandingsColumns;
  costs: ReadonlyMap<string, MetaDeckCost> | undefined;
  pending: MetaPendingRowMark | undefined;
  cutSize: number | null;
  expanded: boolean;
  onToggle: () => void;
}

function ownsClick(event: React.SyntheticEvent<HTMLElement>): boolean {
  const target = event.target;
  return target instanceof Element && target.closest("a, button, [role=menu]") !== null;
}

function rowToggleProps(token: string | null, expanded: boolean, onToggle: () => void) {
  if (token === null) {
    return {};
  }
  return {
    tabIndex: 0,
    "aria-expanded": expanded,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (!ownsClick(event)) {
        onToggle();
      }
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }
      event.preventDefault();
      onToggle();
    },
  };
}

/** Flex-laid-out: a virtualized row needs its own translateY, which a `<tr>` in table layout ignores. */
export function DesktopRow({
  player,
  slug,
  canSubmit,
  columns,
  costs,
  pending,
  cutSize,
  expanded,
  onToggle,
  ...slot
}: RowProps) {
  const token = player.shareToken;

  return (
    <TableRow
      {...slot}
      {...rowToggleProps(token, expanded, onToggle)}
      className={cn(
        "focus-visible:ring-ring aria-expanded:bg-muted/50 flex w-full flex-wrap items-center focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        player.rank === 1 && "bg-border-accent/10",
        token !== null && "cursor-pointer",
      )}
    >
      <TableCell className="flex w-24 shrink-0 self-stretch p-0">
        <RankCell player={player} cutSize={cutSize} className="flex-1" />
      </TableCell>
      {columns.legend && (
        <TableCell className="w-64 shrink-0">
          <LegendCell player={player} />
        </TableCell>
      )}
      <TableCell className="min-w-0 flex-1 truncate font-medium">
        <MetaPlayerName
          name={player.playerName}
          playerKey={player.playerKey}
          eventSlug={player.rounds.length > 0 ? slug : undefined}
        />
      </TableCell>
      {(columns.run || columns.record) && (
        <TableCell className="w-52 shrink-0">
          <RunCell player={player} slug={slug} />
        </TableCell>
      )}
      {columns.value && (
        <TableCell className="w-28 shrink-0 text-right">
          <DeckValue player={player} costs={costs} />
        </TableCell>
      )}
      {columns.deck && (
        <TableCell className="w-36 shrink-0 text-right">
          <DeckCell
            player={player}
            slug={slug}
            canSubmit={canSubmit}
            expanded={expanded}
            pending={pending}
          />
        </TableCell>
      )}
      {expanded && token !== null && (
        <TableCell className="w-full p-3 whitespace-normal">
          <DeckPreview token={token} />
        </TableCell>
      )}
    </TableRow>
  );
}

export function PhoneRow({
  player,
  slug,
  canSubmit,
  columns,
  costs,
  pending,
  cutSize,
  expanded,
  onToggle,
  ...slot
}: RowProps) {
  const token = player.shareToken;

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- the row is the disclosure, with aria-expanded and Enter / Space on itself
    <li
      {...slot}
      {...rowToggleProps(token, expanded, onToggle)}
      className={cn(
        "focus-visible:ring-ring aria-expanded:bg-muted/50 flex flex-col text-sm focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        player.rank === 1 && "bg-border-accent/10",
        token !== null && "cursor-pointer",
      )}
    >
      <div className="flex">
        <RankCell player={player} cutSize={cutSize} className="w-18 shrink-0" />
        <div className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-3 pl-2.5">
          {columns.legend && (
            <CardArtThumb
              imageId={player.legend?.imageId ?? player.champion?.imageId ?? null}
              domains={player.legend?.domains}
              loading="lazy"
              className="w-9"
            />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-medium">
              <MetaPlayerName
                name={player.playerName}
                playerKey={player.playerKey}
                eventSlug={player.rounds.length > 0 ? slug : undefined}
              />
            </p>
            <MetaIdentity
              name={player.legend?.name}
              slug={player.legend?.slug}
              archiveSlug={player.legend?.archiveSlug}
              domains={player.legend?.domains}
              className="text-muted-foreground text-xs"
            />
            {(columns.run || columns.record) && (
              <RunCell player={player} slug={slug} layout="inline" className="mt-1" />
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 leading-tight">
            {columns.value && <DeckValue player={player} costs={costs} />}
            {columns.deck && (
              <DeckCell
                player={player}
                slug={slug}
                canSubmit={canSubmit}
                expanded={expanded}
                pending={pending}
              />
            )}
          </div>
        </div>
      </div>
      {expanded && token !== null && (
        <div className="px-3 pb-2">
          <DeckPreview token={token} />
        </div>
      )}
    </li>
  );
}
