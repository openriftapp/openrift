import { formatDay } from "@openrift/shared/format-date";
import type { MetaPlayerFinish } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Medal } from "@/components/ui/podium";
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
import { MetaShowMore } from "@/features/meta/components/meta-show-more";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank, formatRecord, MEDAL_RANKS } from "@/features/meta/lib/meta-format";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { BEST_FINISH_COUNT, FINISH_PAGE_SIZE } from "@/features/meta/lib/meta-legend-page";
import { sortPlayerFinishes } from "@/features/meta/lib/meta-player-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/lib/auth-session";

function Rank({ finish }: { finish: MetaPlayerFinish }) {
  if (finish.rank <= MEDAL_RANKS) {
    return <Medal rank={finish.rank} />;
  }
  return (
    <span className="text-muted-foreground inline-block w-5 text-center text-sm tabular-nums">
      {formatRank(finish.rank, finish.rankIsTier)}
    </span>
  );
}

function LegendCell({ finish, className }: { finish: MetaPlayerFinish; className?: string }) {
  const { legend } = finish;
  if (legend === null) {
    return <span className="text-muted-foreground text-xs">No legend on file</span>;
  }
  return (
    <MetaIdentity
      name={legend.name}
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
        {finish.listStatus === "partial" ? "Partial" : "Decklist"}
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
      + Add
    </TextLink>
  );
}

function eventFacts(finish: MetaPlayerFinish): string {
  const size = finish.event.playerCount;
  const parts = [formatDay(finish.event.eventDate)];
  if (size !== null) {
    parts.push(`${size.toLocaleString("en-US")} ${size === 1 ? "player" : "players"}`);
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
      <TableCell className="w-12">
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
        <span className="mt-0.5">
          <Rank finish={finish} />
        </span>
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
        <Heading>Finishes</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {narrowed
                ? "No finish on this player's record falls in this scope."
                : "No archived event has this player on its standings yet."}
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
        <Heading>Finishes</Heading>
        {finishes.length > BEST_FINISH_COUNT && (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => {
              setView(view === "best" ? "all" : "best");
              setShown(FINISH_PAGE_SIZE);
            }}
          >
            {view === "best" ? `Show all ${finishes.length.toLocaleString("en-US")}` : "Show fewer"}
          </Button>
        )}
      </div>

      <div>
        <Table variant="divided" className="hidden table-fixed sm:table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-24">Tier</TableHead>
              <TableHead className="w-72">Legend</TableHead>
              <TableHead className="w-20 text-right">Record</TableHead>
              <TableHead className="w-24 text-right">Decklist</TableHead>
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
          <MetaShowMore onClick={() => setShown(shown + FINISH_PAGE_SIZE)}>
            {`${remaining.toLocaleString("en-US")} more ${remaining === 1 ? "finish" : "finishes"}`}
          </MetaShowMore>
        )}
      </div>
    </section>
  );
}
