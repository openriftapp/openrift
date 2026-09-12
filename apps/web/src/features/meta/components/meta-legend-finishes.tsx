import { formatDay } from "@openrift/shared/format-date";
import type { MetaLegendFinish } from "@openrift/shared/types/api/meta";
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
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import { MetaShowMore } from "@/features/meta/components/meta-show-more";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank, formatRecord, MEDAL_RANKS } from "@/features/meta/lib/meta-format";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/lib/auth-session";

function Rank({ finish }: { finish: MetaLegendFinish }) {
  if (finish.rank <= MEDAL_RANKS) {
    return <Medal rank={finish.rank} />;
  }
  return (
    <span className="text-muted-foreground inline-block w-5 text-center text-sm tabular-nums">
      {formatRank(finish.rank, finish.rankIsTier)}
    </span>
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
          search={metaSubmitSearchForPlayer(finish)}
        />
      }
    >
      + Add
    </TextLink>
  );
}

function eventFacts(finish: MetaLegendFinish): string {
  const size = finish.event.playerCount;
  const parts = [formatDay(finish.event.eventDate)];
  if (size !== null) {
    parts.push(`${size.toLocaleString("en-US")} ${size === 1 ? "player" : "players"}`);
  }
  return parts.join(" · ");
}

function FinishTableRow({ finish, canSubmit }: { finish: MetaLegendFinish; canSubmit: boolean }) {
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

/** `narrowed` only picks the empty-state message: "nothing on record" vs "nothing in this scope". */
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

  if (total === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Heading>Finishes</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {narrowed
                ? "No finish on this legend's record falls in this scope."
                : "No archived event has this legend on its standings yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const rows = view === "best" ? best : finishes;
  const remaining = total - rows.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading>Finishes</Heading>
        {total > best.length && (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => setView(view === "best" ? "all" : "best")}
          >
            {view === "best" ? `Show all ${total.toLocaleString("en-US")}` : "Show fewer"}
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
              <TableHead className="w-40">Player</TableHead>
              <TableHead className="w-20 text-right">Record</TableHead>
              <TableHead className="w-24 text-right">Decklist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((finish) => (
              <FinishTableRow key={finish.playerId} finish={finish} canSubmit={canSubmit} />
            ))}
          </TableBody>
        </Table>
        <RowList variant="divided" className="sm:hidden">
          {rows.map((finish) => (
            <FinishPhoneRow key={finish.playerId} finish={finish} canSubmit={canSubmit} />
          ))}
        </RowList>

        {view === "all" && remaining > 0 && (
          <MetaShowMore disabled={loadingMore} onClick={onShowMore}>
            {`${remaining.toLocaleString("en-US")} more ${remaining === 1 ? "finish" : "finishes"}`}
          </MetaShowMore>
        )}
      </div>
    </section>
  );
}
