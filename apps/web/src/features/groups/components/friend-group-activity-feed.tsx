import { dateLeafParts, formatRelativeTime } from "@openrift/shared/format-date";
import type { AggregatedActivityRow, TradeBatch } from "@openrift/shared/friend-group-activity";
import type { FriendGroupActivityEvent } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRightIcon, FolderIcon, SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DateLeaf } from "@/components/ui/date-leaf";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { useFriendGroupActivity } from "@/features/groups/hooks/use-friend-groups";
import {
  buildActivityDays,
  distinctPrintingIds,
} from "@/features/groups/lib/friend-group-activity";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

import { HOVER_ROW_CLASS } from "./hover-row";
import { LIST_INTENT_ICON, listIntentNoun } from "./list-intent-meta";

const FEED_ROWS = 10;

// Derived server-side from existing rows; there is no dedicated event log.
export function FriendGroupActivityFeed({ slug }: { slug: string }) {
  const { data } = useFriendGroupActivity(slug);
  const [expanded, setExpanded] = useState(false);
  const allDays = buildActivityDays(data.events, data.events.length);
  const totalRows = allDays.reduce((count, day) => count + day.rows.length, 0);
  const days = expanded ? allDays : buildActivityDays(data.events, FEED_ROWS);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading>{m.groups_activity_title()}</SectionHeading>
        {totalRows > FEED_ROWS && (
          <Button
            variant="link"
            className="h-auto shrink-0 p-0 text-xs font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? m.groups_activity_show_fewer() : m.groups_activity_show_more()}
          </Button>
        )}
      </div>
      {days.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.groups_activity_empty()}</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {days.map((day) => {
            const leaf = dateLeafParts(day.at);
            return (
              <li
                key={day.key}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3"
              >
                <span className="flex flex-col items-center gap-2 self-stretch">
                  <DateLeaf
                    month={leaf.month}
                    day={leaf.day}
                    caption={formatRelativeTime(day.at)}
                    size="sm"
                    className="mt-1"
                  />
                  <span aria-hidden="true" className="bg-border-accent/60 w-px flex-1" />
                </span>
                <ul className="flex flex-col gap-1">
                  {day.rows.map((row) => (
                    <li key={rowKey(row)}>
                      {row.kind === "trade-batch" ? (
                        <TradeBatchRow slug={slug} batch={row} />
                      ) : (
                        <ActivityRow slug={slug} event={row.event} />
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function rowKey(row: AggregatedActivityRow): string {
  return row.kind === "trade-batch"
    ? `batch:${row.events.map((event) => event.tradeId).join(",")}`
    : activityKey(row.event);
}

function activityKey(event: FriendGroupActivityEvent): string {
  switch (event.kind) {
    case "trade-completed": {
      return `trade:${event.tradeId}`;
    }
    case "member-joined": {
      return `member:${event.userId}`;
    }
    case "list-shared": {
      return `list:${event.listId}`;
    }
    case "collection-shared": {
      return `collection:${event.collectionId}`;
    }
    case "match": {
      return `match:${event.counterpartyUserId}:${event.printingId}`;
    }
  }
}

function TradeBatchRow({ slug, batch }: { slug: string; batch: TradeBatch }) {
  const { printingsById } = useCards();
  const viewerId = useRequiredUserId();
  const thumbs = distinctPrintingIds(batch.events).map((printingId) => ({
    key: printingId,
    imageId: frontImageId(printingsById[printingId]),
  }));
  return (
    <Link to="/groups/$slug/trades" params={{ slug }} className={HOVER_ROW_CLASS}>
      <IconChip icon={ArrowLeftRightIcon} tone="primary" size="sm" shape="round" />
      <CardArtThumbStack items={thumbs} thumbClassName="w-6" />
      <span className="text-muted-foreground line-clamp-2 min-w-0 flex-1 text-sm">
        {m.groups_activity_trade_batch({
          giver:
            batch.giverUserId === viewerId
              ? m.groups_activity_you()
              : (batch.giverName ?? m.groups_activity_a_member()),
          count: batch.totalQuantity,
          receiver:
            batch.receiverUserId === viewerId
              ? m.groups_activity_you_object()
              : (batch.receiverName ?? m.groups_a_member()),
        })}
      </span>
    </Link>
  );
}

function ActivityRow({ slug, event }: { slug: string; event: FriendGroupActivityEvent }) {
  const { cardsById, printingsById } = useCards();
  const viewerId = useRequiredUserId();

  const cardName = (cardId: string): string =>
    cardsById[cardId]?.name ?? m.groups_activity_a_card();
  const thumb = (printingId: string): ReactNode => (
    <CardArtThumbStack
      items={[{ key: printingId, imageId: frontImageId(printingsById[printingId]) }]}
      thumbClassName="w-6"
    />
  );
  const text = (body: ReactNode, before?: ReactNode): ReactNode => (
    <>
      {before}
      <span className="text-muted-foreground line-clamp-2 min-w-0 flex-1 text-sm">{body}</span>
    </>
  );

  // Each branch renders its own concrete <Link> so `to`/`params` stay correlated
  // (TanStack types them together — a shared dynamic `to` would not typecheck).
  switch (event.kind) {
    case "trade-completed": {
      return (
        <Link to="/groups/$slug/trades" params={{ slug }} className={HOVER_ROW_CLASS}>
          <IconChip icon={ArrowLeftRightIcon} tone="primary" size="sm" shape="round" />
          {text(
            m.groups_activity_trade_completed({
              giver:
                event.giverUserId === viewerId
                  ? m.groups_activity_you()
                  : (event.giverName ?? m.groups_activity_a_member()),
              quantity: event.quantity,
              card: cardName(event.cardId),
              receiver:
                event.receiverUserId === viewerId
                  ? m.groups_activity_you_object()
                  : (event.receiverName ?? m.groups_a_member()),
            }),
            thumb(event.printingId),
          )}
        </Link>
      );
    }
    case "match": {
      return (
        <Link to="/groups/$slug/trades" params={{ slug }} className={HOVER_ROW_CLASS}>
          <IconChip icon={SparklesIcon} tone="primary" size="sm" shape="round" />
          {text(
            m.groups_activity_match({
              member: event.counterpartyName ?? m.groups_activity_a_member(),
              card: cardName(event.cardId),
            }),
            thumb(event.printingId),
          )}
        </Link>
      );
    }
    case "member-joined": {
      return (
        <Link
          to="/groups/$slug/members/$userId"
          params={{ slug, userId: event.userId }}
          className={HOVER_ROW_CLASS}
        >
          <UserAvatar
            image={event.userImage}
            name={event.userName}
            gravatarHash={event.gravatarHash}
          />
          {text(
            m.groups_activity_member_joined({
              member: event.userName ?? m.groups_activity_a_member(),
            }),
          )}
        </Link>
      );
    }
    case "list-shared": {
      const Icon = LIST_INTENT_ICON[event.listIntent];
      return (
        <Link
          to="/groups/$slug/lists/$listId"
          params={{ slug, listId: event.listId }}
          className={HOVER_ROW_CLASS}
        >
          <IconChip icon={Icon} size="sm" shape="round" />
          {text(
            m.groups_activity_list_shared({
              member: event.userName ?? m.groups_activity_a_member(),
              noun: listIntentNoun(event.listIntent),
              list: event.listName,
            }),
          )}
        </Link>
      );
    }
    case "collection-shared": {
      return (
        <Link
          to="/groups/$slug/collections/$collectionId"
          params={{ slug, collectionId: event.collectionId }}
          className={HOVER_ROW_CLASS}
        >
          <IconChip icon={FolderIcon} size="sm" shape="round" />
          {text(
            m.groups_activity_collection_shared({
              member: event.userName ?? m.groups_activity_a_member(),
              collection: event.collectionName,
            }),
          )}
        </Link>
      );
    }
  }
}
