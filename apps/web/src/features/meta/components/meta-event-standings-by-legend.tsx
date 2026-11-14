import { NO_LEGEND } from "@openrift/shared/meta-query";
import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { ShowMoreButton } from "@/components/show-more-button";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { rankChipToneClass } from "@/components/ui/rank-band";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import type { StandingsBodyProps } from "@/features/meta/components/meta-event-standings-body";
import {
  DesktopStandings,
  DesktopStandingsHeader,
  PhoneStandings,
} from "@/features/meta/components/meta-event-standings-body";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaListShapeKey } from "@/features/meta/components/meta-list-shape-bar";
import { formatRank } from "@/features/meta/lib/meta-format";
import type { LegendGroupRows, MetaLegendGroup } from "@/features/meta/lib/meta-legend-groups";
import { LEGEND_GROUPS_SHOWN } from "@/features/meta/lib/meta-legend-groups";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type GroupBodyProps = Omit<StandingsBodyProps, "players">;

function PlayerCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("text-muted-foreground text-sm whitespace-nowrap", className)}>
      {m.meta_standings_legend_players({ count })}
    </span>
  );
}

function BestFinish({ best }: { best: MetaStandingsRow }) {
  return (
    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
      {m.meta_standings_legend_best()}
      <span
        className={cn(
          "font-heading rounded-md border px-1.5 font-bold whitespace-nowrap tabular-nums",
          rankChipToneClass(best.rank),
        )}
      >
        {formatRank(best.rank, best.rankIsTier)}
      </span>
      <span className="hidden min-w-0 truncate md:inline">{best.playerName}</span>
    </span>
  );
}

function GroupHeader({
  group,
  open,
  onToggle,
}: {
  group: MetaLegendGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const legend = group.best?.legend ?? null;
  return (
    <ExpandToggle
      expanded={open}
      onClick={onToggle}
      className="bg-card w-full gap-3 py-2.5 pr-3 pl-2 md:pl-4"
    >
      {group.cardId === NO_LEGEND ? (
        <span aria-hidden className="aspect-card w-9 shrink-0 rounded-sm border border-dashed" />
      ) : (
        <CardArtThumb
          imageId={legend?.imageId ?? null}
          domains={legend?.domains}
          loading="lazy"
          className="w-9 shrink-0"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-none md:basis-64">
        {group.cardId === NO_LEGEND ? (
          <span className="text-muted-foreground truncate font-medium">
            {m.meta_standings_legend_unknown()}
          </span>
        ) : legend === null ? (
          <span className="truncate font-medium">{group.name}</span>
        ) : (
          <MetaIdentity legend={legend} domains={legend.domains} layout="stacked" />
        )}
        <span className="flex items-center gap-2 md:hidden">
          <PlayerCount count={group.count} />
          {group.best !== null && <BestFinish best={group.best} />}
        </span>
      </span>
      <PlayerCount count={group.count} className="hidden w-28 md:inline" />
      {group.best !== null && (
        <span className="hidden min-w-0 flex-1 md:flex">
          <BestFinish best={group.best} />
        </span>
      )}
    </ExpandToggle>
  );
}

function GroupRows({
  group,
  rows,
  body,
  onSeeAll,
}: {
  group: MetaLegendGroup;
  rows: LegendGroupRows | undefined;
  body: GroupBodyProps;
  onSeeAll: () => void;
}) {
  if (rows?.isError) {
    return (
      <Empty className="border-t">
        <EmptyHeader>
          <EmptyDescription>{m.common_error_generic()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => void rows.refetch()}>
            {m.common_retry()}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  const players = rows?.players;
  if (players === undefined) {
    return (
      <div className="flex justify-center border-t py-4">
        <Spinner />
      </div>
    );
  }
  const archiveSlug = group.best?.legend?.archiveSlug ?? null;
  return (
    <>
      <div className="border-t">
        <DesktopStandings {...body} players={players} header="screen-reader" />
        <PhoneStandings {...body} players={players} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-sm md:pl-24">
        {group.count > players.length && (
          <Button variant="link" className="h-auto p-0 text-sm font-medium" onClick={onSeeAll}>
            {m.meta_standings_legend_see_all({ count: group.count })}
          </Button>
        )}
        {archiveSlug !== null && (
          <TextLink
            className="text-muted-foreground ml-auto"
            render={<Link to="/meta/legends/$slug" params={{ slug: archiveSlug }} />}
          >
            {m.meta_standings_legend_page()}
          </TextLink>
        )}
      </div>
    </>
  );
}

function GroupSection({
  group,
  open,
  rows,
  body,
  onToggle,
  onSeeAll,
}: {
  group: MetaLegendGroup;
  open: boolean;
  rows: LegendGroupRows | undefined;
  body: GroupBodyProps;
  onToggle: () => void;
  onSeeAll: () => void;
}) {
  return (
    <section className="border-b">
      <GroupHeader group={group} open={open} onToggle={onToggle} />
      {open && <GroupRows group={group} rows={rows} body={body} onSeeAll={onSeeAll} />}
    </section>
  );
}

export function MetaEventStandingsByLegend({
  groups,
  unknownGroup,
  allShown,
  openIds,
  rowsByLegend,
  body,
  onShowAll,
  onToggleGroup,
  onSeeAll,
}: {
  groups: readonly MetaLegendGroup[];
  unknownGroup: MetaLegendGroup | null;
  allShown: boolean;
  openIds: readonly string[];
  rowsByLegend: ReadonlyMap<string, LegendGroupRows | undefined>;
  onShowAll: () => void;
  body: GroupBodyProps;
  onToggleGroup: (cardId: string) => void;
  onSeeAll: (cardId: string) => void;
}) {
  const shown = allShown ? groups : groups.slice(0, LEGEND_GROUPS_SHOWN);
  const shapedRows = [...rowsByLegend.values()].some((rows) =>
    rows?.players?.some((row) => row.listShape !== null),
  );
  const section = (group: MetaLegendGroup) => (
    <GroupSection
      key={group.cardId}
      group={group}
      open={openIds.includes(group.cardId)}
      rows={rowsByLegend.get(group.cardId)}
      body={body}
      onToggle={() => onToggleGroup(group.cardId)}
      onSeeAll={() => onSeeAll(group.cardId)}
    />
  );

  return (
    <div className="border-t">
      <div className="hidden md:block">
        <Table variant="divided" className="block">
          <DesktopStandingsHeader columns={body.columns} />
        </Table>
      </div>
      {shown.map((group) => section(group))}
      {groups.length > LEGEND_GROUPS_SHOWN && (
        <div className="border-b px-3 py-2.5 md:pl-4">
          <ShowMoreButton
            placement="heading"
            count={groups.length}
            expanded={allShown}
            onClick={onShowAll}
          />
        </div>
      )}
      {unknownGroup !== null && section(unknownGroup)}
      {shapedRows && <MetaListShapeKey className="px-3 py-2" />}
    </div>
  );
}
