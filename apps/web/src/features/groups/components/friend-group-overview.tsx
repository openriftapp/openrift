import { dateLeafParts, formatDayTimeLocal, formatTimeLocal } from "@openrift/shared/format-date";
import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { capitalize } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FolderIcon,
  HeartIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { DateLeaf } from "@/components/ui/date-leaf";
import { Empty, EmptyContent, EmptyDescription } from "@/components/ui/empty";
import { IconChip } from "@/components/ui/icon-chip";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import type { StatTileTone } from "@/components/ui/stat-tile";
import { StatTile } from "@/components/ui/stat-tile";
import { TextLink } from "@/components/ui/text-link";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useFriendGroupShopEvents } from "@/features/groups/hooks/use-friend-group-shops";
import { useGroupBoxWants } from "@/features/groups/hooks/use-friend-groups";
import { filterShopEventsByRange } from "@/features/groups/lib/shop-events";
import { useGroupTournaments } from "@/features/tournaments/hooks/use-tournaments";
import {
  compareTournamentsForList,
  partitionTournaments,
} from "@/features/tournaments/lib/tournament-display";
import { useRequiredUserId } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FriendGroupActivityFeed } from "./friend-group-activity-feed";
import { isAdmin } from "./friend-group-shell";
import { GroupSetupNudges } from "./group-setup-nudges";
import { LIST_INTENT_ICON, listIntentNoun } from "./list-intent-meta";
import { PendingRequestsBand } from "./pending-requests-band";
import { TradesHubBand } from "./trades-hub-band";

export function OverviewContent({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  return (
    <div className="flex flex-col gap-8">
      {isAdmin(data.viewerRole) && data.pendingRequests.length > 0 ? (
        <PendingRequestsBand slug={slug} requests={data.pendingRequests} />
      ) : null}
      <GroupSetupNudges slug={slug} data={data} />
      <TradesHubBand slug={slug} data={data} />
      <ActionTiles slug={slug} data={data} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <FriendGroupActivityFeed slug={slug} />
        <OverviewRail slug={slug} data={data} />
      </div>
    </div>
  );
}

function OverviewSlotEmpty({ description, action }: { description: string; action?: ReactNode }) {
  return (
    <Empty className="gap-3 py-8">
      <EmptyDescription>{description}</EmptyDescription>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

function ActionTiles({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const viewerId = useRequiredUserId();
  const { data: collections } = useCollections();

  const groupCollections = collections.filter((col) => col.groupId === data.group.id);
  const memberShareCount = data.collectionShares.filter(
    (share) => share.userId !== viewerId,
  ).length;

  const boxWants = useGroupBoxWants(groupCollections.length > 0 ? slug : undefined);

  const bestBoxId = boxWants.bestCollection(groupCollections.map((box) => box.id));
  const wantedBox = groupCollections.find((col) => col.id === bestBoxId);
  const boxesWithWants = groupCollections.filter(
    (col) => boxWants.wantedCardCount(col.id) > 0,
  ).length;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        wantedBox ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {wantedBox ? (
        <StatTile
          render={
            <Link
              to="/collections/$collectionId"
              params={{ collectionId: wantedBox.id }}
              search={{ wanted: true }}
            />
          }
          icon={HeartIcon}
          tone="gold"
          label={m.groups_overview_cards_you_want()}
          value={boxWants.wantedCardCount()}
          hint={
            boxesWithWants > 1
              ? m.groups_overview_across_boxes({ count: boxesWithWants })
              : m.groups_overview_waiting_in({ name: wantedBox.name })
          }
        />
      ) : null}
      <GroupTournamentsTile slug={slug} data={data} />
      <StatCard
        to="/groups/$slug/shared"
        slug={slug}
        icon={FolderIcon}
        tone="info"
        label={m.groups_overview_group_collections()}
        value={groupCollections.length}
        hint={
          memberShareCount > 0
            ? m.groups_overview_shared_by_members({ count: memberShareCount })
            : m.groups_overview_owned_by_group()
        }
      />
      <MembersCard slug={slug} data={data} />
    </div>
  );
}

// The group-tournaments list is member-scoped server-side, so the query is safe for any role.
function GroupTournamentsTile({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: tournaments } = useGroupTournaments(slug);
  // Uses the same "current" bucket as the events page so the two never disagree.
  const open = partitionTournaments(tournaments.items).current;
  const joined = open.filter((tournament) => tournament.myRoles.includes("participant")).length;

  if (open.length === 0) {
    return (
      <StatCard
        to="/groups/$slug/events"
        slug={slug}
        icon={TrophyIcon}
        tone="violet"
        label={m.groups_nav_tournaments()}
        value={tournaments.items.length}
        hint={
          isAdmin(data.viewerRole)
            ? m.groups_overview_plan_one()
            : tournaments.items.length === 0
              ? m.groups_overview_no_tournaments_yet()
              : m.groups_overview_none_open()
        }
      />
    );
  }
  return (
    <StatCard
      to="/groups/$slug/events"
      slug={slug}
      icon={TrophyIcon}
      tone="violet"
      label={m.groups_overview_open_tournaments()}
      value={open.length}
      hint={
        joined > 0
          ? m.groups_overview_youre_in({ count: joined })
          : m.groups_overview_tournaments_total({ count: tournaments.items.length })
      }
    />
  );
}

type StatCardTarget =
  | "/groups/$slug/trades"
  | "/groups/$slug/shared"
  | "/groups/$slug/members"
  | "/groups/$slug/events";

function StatCard({
  to,
  slug,
  ...props
}: {
  to: StatCardTarget;
  slug: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode;
  valueClassName?: string;
  accent?: boolean;
  tone?: StatTileTone;
  hint?: ReactNode;
  children?: ReactNode;
}): ReactNode {
  return <StatTile render={<Link to={to} params={{ slug }} />} {...props} />;
}

function MembersCard({ slug, data }: { slug: string; data: FriendGroupDetailResponse }): ReactNode {
  const shown = data.members.slice(0, 5);
  return (
    <StatCard
      to="/groups/$slug/members"
      slug={slug}
      icon={UsersIcon}
      tone="success"
      label={m.groups_nav_members()}
      value={data.members.length}
    >
      <UserAvatarStack members={shown} totalCount={data.members.length} size="sm" />
    </StatCard>
  );
}

function OverviewRail({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  return (
    <aside className="flex flex-col gap-8">
      <NewestShared slug={slug} data={data} />
      <ShopNextUp slug={slug} data={data} />
      <TournamentNudge slug={slug} data={data} />
    </aside>
  );
}

function ShopNextUp({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: feed } = useFriendGroupShopEvents(slug);
  const admin = isAdmin(data.viewerRole);
  const upcoming = filterShopEventsByRange(feed.items, "upcoming");

  if (feed.shops.length === 0 && !admin) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading>{m.groups_overview_next_at_shops()}</SectionHeading>
        {feed.shops.length > 0 ? (
          <TextLink
            className="shrink-0 text-xs font-medium"
            render={<Link to="/groups/$slug/shops" params={{ slug }} />}
          >
            {m.groups_overview_show_all()}
          </TextLink>
        ) : null}
      </div>
      {upcoming.length > 0 ? (
        <RowList>
          {upcoming.slice(0, 3).map((event) => {
            const leaf = dateLeafParts(event.startAt);
            return (
              <RowListItem key={event.externalId}>
                {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- text label is inside the RowListLink children */}
                <RowListLink render={<a href={event.url} target="_blank" rel="noreferrer" />}>
                  <DateLeaf month={leaf.month} day={leaf.day} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{event.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {formatTimeLocal(event.startAt)} · {event.storeName}
                    </span>
                  </span>
                  <ExternalLinkIcon className="text-muted-foreground/40 size-4 shrink-0" />
                </RowListLink>
              </RowListItem>
            );
          })}
        </RowList>
      ) : (
        <OverviewSlotEmpty
          description={
            feed.shops.length === 0
              ? m.groups_overview_no_shop_linked()
              : m.groups_overview_nothing_at_shops({ days: feed.horizonDays })
          }
          action={
            admin && feed.shops.length === 0 ? (
              <TextLink
                className="inline-flex items-center gap-1 text-sm font-medium"
                render={<Link to="/groups/$slug/manage" params={{ slug }} hash="shops" />}
              >
                {m.groups_link_a_shop()}
                <ChevronRightIcon className="size-4" />
              </TextLink>
            ) : null
          }
        />
      )}
    </section>
  );
}

type SharedRow = {
  key: string;
  sharedAt: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  name: string;
  sub: string;
} & ({ target: "list"; listId: string } | { target: "collection"; collectionId: string });

function RailRowBody({ row }: { row: SharedRow }) {
  return (
    <>
      <span className="flex w-11 shrink-0 justify-center">
        <IconChip icon={row.icon} size="sm" shape="round" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{row.name}</span>
        <span className="text-muted-foreground truncate text-xs">{row.sub}</span>
      </span>
    </>
  );
}

function NewestShared({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const all: SharedRow[] = [
    ...data.shares.map((share): SharedRow => ({
      key: `list:${share.listId}`,
      sharedAt: share.sharedAt,
      icon: LIST_INTENT_ICON[share.listIntent],
      name: share.listName,
      sub: `${capitalize(listIntentNoun(share.listIntent))} · ${share.userName ?? m.groups_a_member()}`,
      target: "list",
      listId: share.listId,
    })),
    ...data.collectionShares.map((share): SharedRow => ({
      key: `collection:${share.collectionId}`,
      sharedAt: share.sharedAt,
      icon: FolderIcon,
      name: share.collectionName,
      sub: `${m.groups_overview_collection_noun()} · ${share.userName ?? m.groups_a_member()}`,
      target: "collection",
      collectionId: share.collectionId,
    })),
  ].toSorted((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const rows = all.slice(0, 3);

  if (rows.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading>{m.groups_overview_newest_shared()}</SectionHeading>
        {all.length > rows.length ? (
          <TextLink
            className="shrink-0 text-xs font-medium"
            render={<Link to="/groups/$slug/shared" params={{ slug }} />}
          >
            {m.groups_overview_show_all()}
          </TextLink>
        ) : null}
      </div>
      <RowList>
        {rows.map((row) => (
          <RowListItem key={row.key}>
            {/* Each branch renders its own concrete <Link> so `to`/`params` stay correlated. */}
            {row.target === "list" ? (
              <RowListLink
                render={
                  <Link to="/groups/$slug/lists/$listId" params={{ slug, listId: row.listId }} />
                }
              >
                <RailRowBody row={row} />
              </RowListLink>
            ) : (
              <RowListLink
                render={
                  <Link
                    to="/groups/$slug/collections/$collectionId"
                    params={{ slug, collectionId: row.collectionId }}
                  />
                }
              >
                <RailRowBody row={row} />
              </RowListLink>
            )}
          </RowListItem>
        ))}
      </RowList>
    </section>
  );
}

function TournamentNudge({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: tournaments } = useGroupTournaments(slug);
  const current = partitionTournaments(tournaments.items)
    .current.toSorted((a, b) => compareTournamentsForList(a, b))
    .slice(0, 2);
  const admin = isAdmin(data.viewerRole);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading>{m.groups_overview_next_up()}</SectionHeading>
        {tournaments.items.length > 0 ? (
          <TextLink
            className="shrink-0 text-xs font-medium"
            render={<Link to="/groups/$slug/events" params={{ slug }} />}
          >
            {m.groups_overview_show_all()}
          </TextLink>
        ) : null}
      </div>
      {current.length > 0 ? (
        <RowList>
          {current.map((tournament) => (
            <RowListItem key={tournament.id}>
              <RowListLink render={<Link to="/tournaments/$id" params={{ id: tournament.id }} />}>
                <span className="flex w-11 shrink-0 justify-center">
                  <IconChip icon={TrophyIcon} tone="violet" size="sm" shape="round" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{tournament.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {formatDayTimeLocal(tournament.startsAt)}
                  </span>
                </span>
              </RowListLink>
            </RowListItem>
          ))}
        </RowList>
      ) : (
        <OverviewSlotEmpty
          description={
            admin
              ? m.groups_overview_no_tournaments_admin()
              : m.groups_overview_no_tournaments_member()
          }
          action={
            admin ? (
              <TextLink
                className="inline-flex items-center gap-1 text-sm font-medium"
                render={<Link to="/groups/$slug/events" params={{ slug }} />}
              >
                {m.groups_overview_plan_a_tournament()}
                <ChevronRightIcon className="size-4" />
              </TextLink>
            ) : null
          }
        />
      )}
    </section>
  );
}
