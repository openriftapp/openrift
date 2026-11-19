import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { useCards } from "@/features/cards/hooks/use-cards";
import { printingArt, printingDisplayName } from "@/features/cards/lib/card-meta";
import { distinctPrintingIds } from "@/features/groups/lib/friend-group-activity";
import { needsYouLine, nextMoveLabel } from "@/features/groups/lib/trade-hub";
import { tradePrinting } from "@/features/groups/lib/trade-printing";
import type { TradesIndex, TradesIndexPerson } from "@/features/groups/lib/trades-index";
import { formatList } from "@/lib/format-list";
import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

const WAITING_SHOWN = 3;

type RowStage = "your-move" | "to-swap" | "waiting";

function stageTrades(person: TradesIndexPerson, stage: RowStage): CardTradeResponse[] {
  if (stage === "your-move") {
    return person.needsYou;
  }
  return stage === "to-swap" ? person.toSwap : person.waiting;
}

function cardsLine(names: readonly string[]): string {
  const [first] = names;
  if (first === undefined) {
    return "";
  }
  return names.length > 2
    ? m.trades_row_card_and_more({ card: first, count: names.length - 1 })
    : formatList(names);
}

function RowSummary({ trades }: { trades: readonly CardTradeResponse[] }) {
  const { printingsById, printingsByCardId } = useCards();
  const namesFor = (role: CardTradeResponse["role"]) => [
    ...new Set(
      trades.flatMap((trade) => {
        if (trade.role !== role) {
          return [];
        }
        const printing = tradePrinting(trade, printingsByCardId, printingsById);
        return printing === undefined ? [] : [printingDisplayName(printing)];
      }),
    ),
  ];
  const parts = [];
  const get = namesFor("receiver");
  const give = namesFor("giver");
  if (get.length > 0) {
    parts.push(m.trades_row_you_get({ cards: cardsLine(get) }));
  }
  if (give.length > 0) {
    parts.push(m.trades_row_you_give({ cards: cardsLine(give) }));
  }
  return <span className="truncate">{parts.join(" · ")}</span>;
}

function rowMeta(person: TradesIndexPerson, stage: RowStage): string {
  const parts: string[] = [];
  if (stage === "your-move") {
    const line = needsYouLine(person.needsYou);
    if (line !== null) {
      parts.push(line);
    }
  }
  if (person.newAgreedCount > 0) {
    parts.push(m.trades_new_agreed_count({ count: person.newAgreedCount }));
  }
  if (stage !== "to-swap" && person.toSwap.length > 0) {
    parts.push(m.trades_to_swap({ count: person.toSwap.length }));
  }
  if (stage !== "waiting" && person.waiting.length > 0) {
    parts.push(m.trades_waiting_on_them({ count: person.waiting.length }));
  }
  return parts.join(" · ");
}

function StageBadge({ stage }: { stage: RowStage }) {
  if (stage === "your-move") {
    return <Badge variant="subtle">{m.trades_badge_your_move()}</Badge>;
  }
  if (stage === "to-swap") {
    return <Badge variant="success">{m.trades_badge_ready_to_swap()}</Badge>;
  }
  return <Badge variant="neutral">{m.trades_section_waiting()}</Badge>;
}

function InProgressRow({
  person,
  stage,
  showGroups,
  fromGroupSlug,
}: {
  person: TradesIndexPerson;
  stage: RowStage;
  showGroups: boolean;
  fromGroupSlug?: string;
}) {
  const { printingsById } = useCards();
  const trades = stageTrades(person, stage);
  const art = distinctPrintingIds(trades).map((printingId) => ({
    key: printingId,
    ...printingArt(printingsById[printingId]),
  }));
  const meta = rowMeta(person, stage);
  const label = stage === "waiting" ? m.trades_your_move_open() : nextMoveLabel(trades[0]);
  return (
    <li className="flex flex-col gap-3 rounded-md p-3 sm:grid sm:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <UserAvatar
          image={person.image}
          name={person.name}
          gravatarHash={person.gravatarHash}
          size="sm"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{memberName(person.name)}</span>
          {showGroups ? (
            <span className="text-muted-foreground truncate text-xs">
              {person.groupNames.join(" · ")}
            </span>
          ) : null}
        </div>
        <span className="sm:hidden">
          <StageBadge stage={stage} />
        </span>
      </div>
      <span className="max-sm:hidden">
        <StageBadge stage={stage} />
      </span>
      <div className="flex min-w-0 items-center gap-3">
        {art.length > 0 ? <CardArtThumbStack items={art} max={4} thumbClassName="w-8" /> : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <RowSummary trades={trades} />
          {meta === "" ? null : (
            <span className="text-muted-foreground truncate text-xs">{meta}</span>
          )}
        </div>
      </div>
      <Link
        to="/trades/$userId"
        params={{ userId: person.userId }}
        search={{ from: fromGroupSlug }}
        className={buttonVariants({
          variant: stage === "your-move" ? "default" : stage === "to-swap" ? "outline" : "ghost",
          className: "sm:justify-self-end",
        })}
      >
        {label}
      </Link>
    </li>
  );
}

export function TradesInProgress({
  index,
  showGroups,
  fromGroupSlug,
}: {
  index: TradesIndex;
  showGroups: boolean;
  fromGroupSlug?: string;
}) {
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const total = index.yourMove.length + index.toSwap.length + index.waiting.length;
  if (total === 0) {
    return null;
  }
  const waiting = showAllWaiting ? index.waiting : index.waiting.slice(0, WAITING_SHOWN);
  const hiddenWaiting = index.waiting.length - waiting.length;
  const rows: { person: TradesIndexPerson; stage: RowStage }[] = [
    ...index.yourMove.map((person) => ({ person, stage: "your-move" as const })),
    ...index.toSwap.map((person) => ({ person, stage: "to-swap" as const })),
    ...waiting.map((person) => ({ person, stage: "waiting" as const })),
  ];
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={total}>{m.trades_section_in_progress()}</SectionHeading>
      <CardList className="divide-border gap-0 divide-y">
        {rows.map(({ person, stage }) => (
          <InProgressRow
            key={person.userId}
            person={person}
            stage={stage}
            showGroups={showGroups}
            fromGroupSlug={fromGroupSlug}
          />
        ))}
        {hiddenWaiting > 0 ? (
          <li className="flex justify-center p-1">
            <Button variant="ghost" onClick={() => setShowAllWaiting(true)}>
              {m.trades_waiting_show_more({ count: hiddenWaiting })}
              <ChevronDownIcon />
            </Button>
          </li>
        ) : null}
      </CardList>
    </section>
  );
}
