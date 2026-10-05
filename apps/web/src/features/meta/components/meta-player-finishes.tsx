import { formatDay } from "@openrift/shared/format-date";
import { formatRecord } from "@openrift/shared/meta-standings";
import type { MetaPlayerFinish } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { ShowMoreButton } from "@/components/show-more-button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { RankBand } from "@/components/ui/rank-band";
import { RowList } from "@/components/ui/row-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank } from "@/features/meta/lib/meta-format";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { BEST_FINISH_COUNT, FINISH_PAGE_SIZE } from "@/features/meta/lib/meta-legend-page";
import { sortPlayerFinishes } from "@/features/meta/lib/meta-player-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

function Rank({ finish }: { finish: MetaPlayerFinish }) {
  return (
    <RankBand
      rank={finish.rank}
      text={formatRank(finish.rank, finish.rankIsTier)}
      filled={false}
      className="w-16 shrink-0 rounded-md"
    />
  );
}

function LegendCell({ finish, className }: { finish: MetaPlayerFinish; className?: string }) {
  const { legend } = finish;
  if (legend === null) {
    return (
      <span className="text-muted-foreground text-xs">{m.meta_player_finishes_no_legend()}</span>
    );
  }
  return (
    <MetaIdentity
      legend={legend}
      slug={legend.slug}
      archiveSlug={legend.archiveSlug}
      domains={legend.domains}
      className={className}
    />
  );
}

function ListLink({
  finish,
  playerName,
  canSubmit,
}: {
  finish: MetaPlayerFinish;
  playerName: string;
  canSubmit: boolean;
}) {
  if (finish.shareToken !== null) {
    return (
      <TextLink
        className="font-medium whitespace-nowrap"
        render={<Link to="/meta/decks/$token" params={{ token: finish.shareToken }} />}
      >
        {finish.listStatus === "partial"
          ? m.meta_list_partial_short()
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
          to="/meta/$slug/submit"
          params={{ slug: finish.event.slug }}
          search={metaSubmitSearchForPlayer({ ...finish, playerName })}
        />
      }
    >
      {m.meta_add_deck_link()}
    </TextLink>
  );
}

function eventFacts(finish: MetaPlayerFinish): string {
  const size = finish.event.playerCount;
  const parts = [formatDay(finish.event.eventDate)];
  if (size !== null) {
    parts.push(m.meta_count_players({ count: size }));
  }
  return parts.join(" · ");
}

function FinishTableRow({
  finish,
  playerName,
  canSubmit,
}: {
  finish: MetaPlayerFinish;
  playerName: string;
  canSubmit: boolean;
}) {
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
      <TableCell className="w-72 max-w-72">
        <LegendCell finish={finish} />
      </TableCell>
      <TableCell className="w-20 text-right tabular-nums">{record}</TableCell>
      <TableCell className="w-24 text-right">
        <ListLink finish={finish} playerName={playerName} canSubmit={canSubmit} />
      </TableCell>
    </TableRow>
  );
}

function FinishPhoneRow({
  finish,
  playerName,
  canSubmit,
}: {
  finish: MetaPlayerFinish;
  playerName: string;
  canSubmit: boolean;
}) {
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
            <LegendCell finish={finish} />
            {record !== null && (
              <span className="text-muted-foreground tabular-nums">{record}</span>
            )}
            <ListLink finish={finish} playerName={playerName} canSubmit={canSubmit} />
          </p>
        </div>
      </div>
    </li>
  );
}

export function MetaPlayerFinishes({
  finishes,
  playerName,
  narrowed = false,
}: {
  finishes: readonly MetaPlayerFinish[];
  playerName: string;
  narrowed?: boolean;
}) {
  const canSubmit = useUserId() !== null;
  const [view, setView] = useState<MetaFinishesView>("best");
  const [shown, setShown] = useState(FINISH_PAGE_SIZE);

  if (finishes.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Heading>{m.meta_finishes_heading()}</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {narrowed ? m.meta_finishes_player_scope_empty() : m.meta_finishes_player_empty()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const sorted = sortPlayerFinishes(finishes, view);
  const rows = view === "best" ? sorted.slice(0, BEST_FINISH_COUNT) : sorted.slice(0, shown);
  const remaining = finishes.length - rows.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading>{m.meta_finishes_heading()}</Heading>
        {finishes.length > BEST_FINISH_COUNT && (
          <ShowMoreButton
            placement="heading"
            count={finishes.length}
            expanded={view === "all"}
            onClick={() => {
              setView(view === "best" ? "all" : "best");
              setShown(FINISH_PAGE_SIZE);
            }}
          />
        )}
      </div>

      <div>
        <Table variant="divided" className="hidden table-fixed sm:table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">{m.meta_standings_col_rank()}</TableHead>
              <TableHead>{m.meta_finishes_col_event()}</TableHead>
              <TableHead className="w-24">{m.meta_finishes_col_tier()}</TableHead>
              <TableHead className="w-72">{m.meta_standings_col_legend()}</TableHead>
              <TableHead className="w-20 text-right">{m.meta_finishes_col_record()}</TableHead>
              <TableHead className="w-24 text-right">{m.meta_standings_decklist()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((finish) => (
              <FinishTableRow
                key={finish.playerId}
                finish={finish}
                playerName={playerName}
                canSubmit={canSubmit}
              />
            ))}
          </TableBody>
        </Table>
        <RowList variant="divided" className="sm:hidden">
          {rows.map((finish) => (
            <FinishPhoneRow
              key={finish.playerId}
              finish={finish}
              playerName={playerName}
              canSubmit={canSubmit}
            />
          ))}
        </RowList>

        {view === "all" && remaining > 0 && (
          <ShowMoreButton onClick={() => setShown(shown + FINISH_PAGE_SIZE)}>
            {m.meta_finishes_more({ count: remaining })}
          </ShowMoreButton>
        )}
      </div>
    </section>
  );
}
