import type { MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { ExpandToggle } from "@/components/ui/expand-toggle";
import { rankChipToneClass } from "@/components/ui/rank-band";
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
import { formatRank } from "@/features/meta/lib/meta-format";
import type { MetaLegendGroup } from "@/features/meta/lib/meta-legend-groups";
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
  const best = group.players[0];
  const legend = best?.legend ?? null;
  const count = group.players.length;
  return (
    <ExpandToggle
      expanded={open}
      onClick={onToggle}
      className="bg-card w-full gap-3 py-2.5 pr-3 pl-2 md:pl-4"
    >
      {legend === null ? (
        <span aria-hidden className="aspect-card w-9 shrink-0 rounded-sm border border-dashed" />
      ) : (
        <CardArtThumb
          imageId={legend.imageId}
          domains={legend.domains}
          loading="lazy"
          className="w-9 shrink-0"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-none md:basis-64">
        {legend === null ? (
          <span className="text-muted-foreground truncate font-medium">
            {m.meta_standings_legend_unknown()}
          </span>
        ) : (
          <MetaIdentity legend={legend} domains={legend.domains} layout="stacked" />
        )}
        <span className="flex items-center gap-2 md:hidden">
          <PlayerCount count={count} />
          {legend !== null && best !== undefined && <BestFinish best={best} />}
        </span>
      </span>
      <PlayerCount count={count} className="hidden w-28 md:inline" />
      {legend !== null && best !== undefined && (
        <span className="hidden min-w-0 flex-1 md:flex">
          <BestFinish best={best} />
        </span>
      )}
    </ExpandToggle>
  );
}

function GroupSection({
  group,
  open,
  body,
  onToggle,
}: {
  group: MetaLegendGroup;
  open: boolean;
  body: GroupBodyProps;
  onToggle: () => void;
}) {
  const archiveSlug = group.players[0]?.legend?.archiveSlug ?? null;
  return (
    <section className="border-b">
      <GroupHeader group={group} open={open} onToggle={onToggle} />
      {open && (
        <>
          <div className="border-t">
            <DesktopStandings {...body} players={group.players} header="screen-reader" />
            <PhoneStandings {...body} players={group.players} />
          </div>
          {archiveSlug !== null && (
            <div className="flex justify-end border-t px-3 py-2 text-sm">
              <TextLink
                className="text-muted-foreground"
                render={<Link to="/meta/legends/$slug" params={{ slug: archiveSlug }} />}
              >
                {m.meta_standings_legend_page()}
              </TextLink>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function MetaEventStandingsByLegend({
  groups,
  openIds,
  body,
  onToggleGroup,
}: {
  groups: readonly MetaLegendGroup[];
  openIds: readonly string[];
  body: GroupBodyProps;
  onToggleGroup: (cardId: string) => void;
}) {
  return (
    <div className="border-t">
      <div className="hidden md:block">
        <Table variant="divided" className="block">
          <DesktopStandingsHeader columns={body.columns} />
        </Table>
      </div>
      {groups.map((group) => (
        <GroupSection
          key={group.cardId}
          group={group}
          open={openIds.includes(group.cardId)}
          body={body}
          onToggle={() => onToggleGroup(group.cardId)}
        />
      ))}
    </div>
  );
}
