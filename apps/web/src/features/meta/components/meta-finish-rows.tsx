import { formatDay } from "@openrift/shared/format-date";
import type { MetaLegendFinish } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { RankBand } from "@/components/ui/rank-band";
import { TableCell, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { formatRank, formatStandingsRecord } from "@/features/meta/lib/meta-format";
import type { MetaSubmitSearch } from "@/features/meta/lib/meta-submit-link";
import { m } from "@/paraglide/messages.js";

type FinishRowData = Pick<
  MetaLegendFinish,
  "rank" | "rankIsTier" | "wins" | "losses" | "draws" | "shareToken" | "listStatus" | "event"
>;

function Rank({ finish }: { finish: FinishRowData }) {
  return (
    <RankBand
      rank={finish.rank}
      text={formatRank(finish.rank, finish.rankIsTier)}
      filled={false}
      className="w-16 shrink-0"
    />
  );
}

function ListLink({
  finish,
  submitSearch,
}: {
  finish: FinishRowData;
  submitSearch: MetaSubmitSearch | null;
}) {
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
  if (submitSearch === null) {
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
          search={submitSearch}
        />
      }
    >
      {m.meta_add_deck_link()}
    </TextLink>
  );
}

function eventFacts(finish: FinishRowData): string {
  const size = finish.event.playerCount;
  const parts = [formatDay(finish.event.eventDate)];
  if (size !== null) {
    parts.push(m.meta_count_players({ count: size }));
  }
  return parts.join(" · ");
}

export function FinishTableRow({
  finish,
  identity,
  identityClassName,
  submitSearch,
}: {
  finish: FinishRowData;
  identity: ReactNode;
  identityClassName: string;
  submitSearch: MetaSubmitSearch | null;
}) {
  const record = formatStandingsRecord(finish.wins, finish.losses, finish.draws);

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
      <TableCell className={identityClassName}>{identity}</TableCell>
      <TableCell className="w-20 text-right tabular-nums">{record}</TableCell>
      <TableCell className="w-24 text-right">
        <ListLink finish={finish} submitSearch={submitSearch} />
      </TableCell>
    </TableRow>
  );
}

export function FinishPhoneRow({
  finish,
  identity,
  submitSearch,
}: {
  finish: FinishRowData;
  identity: ReactNode;
  submitSearch: MetaSubmitSearch | null;
}) {
  const record = formatStandingsRecord(finish.wins, finish.losses, finish.draws);

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
            {identity}
            {record !== null && (
              <span className="text-muted-foreground tabular-nums">{record}</span>
            )}
            <ListLink finish={finish} submitSearch={submitSearch} />
          </p>
        </div>
      </div>
    </li>
  );
}
