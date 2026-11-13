import { formatDay } from "@openrift/shared/format-date";
import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaLegendFinish } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { RankBand } from "@/components/ui/rank-band";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { MetaFinishesSection } from "@/features/meta/components/meta-finishes-section";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank } from "@/features/meta/lib/meta-format";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

function Rank({ finish }: { finish: MetaLegendFinish }) {
  return (
    <RankBand
      rank={finish.rank}
      text={formatRank(finish.rank, finish.rankIsTier)}
      filled={false}
      className="w-16 shrink-0"
    />
  );
}

/** A signed-out reader gets no submit link: the form is behind a login. */
function ListLink({ finish, canSubmit }: { finish: MetaLegendFinish; canSubmit: boolean }) {
  if (finish.shareToken !== null) {
    return (
      <TextLink
        className="font-medium whitespace-nowrap"
        render={<Link to="/meta/decks/$token" params={{ token: finish.shareToken }} />}
      >
        {finish.listStatus === "partial"
          ? m.meta_list_status_partial()
          : m.meta_standings_decklist()}
      </TextLink>
    );
  }
  if (!canSubmit) {
    return null;
  }
  return (
    <TextLink
      className="font-medium whitespace-nowrap"
      render={
        <Link
          rel="nofollow"
          to="/meta/$slug/submit"
          params={{ slug: finish.event.slug }}
          search={metaSubmitSearchForPlayer(finish)}
        />
      }
    >
      {m.meta_add_deck_link()}
    </TextLink>
  );
}

function eventFacts(finish: MetaLegendFinish): string {
  const size = finish.event.playerCount;
  const parts = [formatDay(finish.event.eventDate)];
  if (size !== null) {
    parts.push(m.meta_count_players({ count: size }));
  }
  return parts.join(" · ");
}

function FinishTableRow({ finish, canSubmit }: { finish: MetaLegendFinish; canSubmit: boolean }) {
  const record = formatRecord(finish.wins, finish.losses, finish.draws);

  return (
    <TableRow>
      <TableCell className="w-20">
        <Rank finish={finish} />
      </TableCell>
      <TableCell>
        <TextLink
          variant="inherit"
          className="block truncate font-medium"
          render={<Link to="/meta/$slug" params={{ slug: finish.event.slug }} />}
        >
          {finish.event.name}
        </TextLink>
        <p className="text-muted-foreground truncate text-xs tabular-nums">{eventFacts(finish)}</p>
      </TableCell>
      <TableCell className="w-24">
        <MetaTierBadge tier={finish.event.tier} />
      </TableCell>
      <TableCell className="w-40 max-w-40 truncate font-medium">
        <MetaPlayerName name={finish.playerName} playerKey={finish.playerKey} />
      </TableCell>
      <TableCell className="w-20 text-right tabular-nums">{record}</TableCell>
      <TableCell className="w-24 text-right">
        <ListLink finish={finish} canSubmit={canSubmit} />
      </TableCell>
    </TableRow>
  );
}

function FinishPhoneRow({ finish, canSubmit }: { finish: MetaLegendFinish; canSubmit: boolean }) {
  const record = formatRecord(finish.wins, finish.losses, finish.draws);

  return (
    <li>
      <div className="flex items-start gap-2.5 sm:hidden">
        <Rank finish={finish} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <TextLink
            variant="inherit"
            className="truncate font-medium"
            render={<Link to="/meta/$slug" params={{ slug: finish.event.slug }} />}
          >
            {finish.event.name}
          </TextLink>
          <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
            <MetaTierBadge tier={finish.event.tier} />
            <span className="tabular-nums">{eventFacts(finish)}</span>
          </p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
            <MetaPlayerName
              name={finish.playerName}
              playerKey={finish.playerKey}
              className="truncate font-medium"
            />
            {record !== null && (
              <span className="text-muted-foreground tabular-nums">{record}</span>
            )}
            <ListLink finish={finish} canSubmit={canSubmit} />
          </p>
        </div>
      </div>
    </li>
  );
}

export function MetaLegendFinishes({
  best,
  finishes,
  total,
  loadingMore = false,
  onShowMore,
  narrowed = false,
}: {
  best: readonly MetaLegendFinish[];
  finishes: readonly MetaLegendFinish[];
  total: number;
  loadingMore?: boolean;
  onShowMore: () => void;
  narrowed?: boolean;
}) {
  const canSubmit = useUserId() !== null;
  const [view, setView] = useState<MetaFinishesView>("best");
  const rows = view === "best" ? best : finishes;

  return (
    <MetaFinishesSection
      total={total}
      emptyMessage={
        narrowed ? m.meta_finishes_legend_scope_empty() : m.meta_finishes_legend_empty()
      }
      canExpand={total > best.length}
      expanded={view === "all"}
      onToggleExpanded={() => setView(view === "best" ? "all" : "best")}
      remaining={total - rows.length}
      loadingMore={loadingMore}
      onShowMore={onShowMore}
      columns={
        <>
          <TableHead className="w-20">{m.meta_standings_col_rank()}</TableHead>
          <TableHead>{m.meta_finishes_col_event()}</TableHead>
          <TableHead className="w-24">{m.meta_finishes_col_tier()}</TableHead>
          <TableHead className="w-40">{m.meta_standings_col_player()}</TableHead>
          <TableHead className="w-20 text-right">{m.meta_finishes_col_record()}</TableHead>
          <TableHead className="w-24 text-right">{m.meta_standings_decklist()}</TableHead>
        </>
      }
      tableRows={rows.map((finish) => (
        <FinishTableRow key={finish.playerId} finish={finish} canSubmit={canSubmit} />
      ))}
      phoneRows={rows.map((finish) => (
        <FinishPhoneRow key={finish.playerId} finish={finish} canSubmit={canSubmit} />
      ))}
    />
  );
}
