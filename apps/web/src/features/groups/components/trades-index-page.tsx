import { Link, getRouteApi } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardDetailOverlayProvider } from "@/features/cards/components/card-detail-opener";
import { ShareYourListsBand } from "@/features/groups/components/share-your-lists-band";
import { TradeFinder } from "@/features/groups/components/trade-finder";
import { TradesGroupTitle } from "@/features/groups/components/trades-group-title";
import { TradesInProgress } from "@/features/groups/components/trades-in-progress";
import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { useFriendGroupsList } from "@/features/groups/hooks/use-friend-groups";
import type { TradesIndexPerson } from "@/features/groups/lib/trades-index";
import {
  buildTradesIndex,
  selectedTradesGroup,
  tradesInGroup,
} from "@/features/groups/lib/trades-index";
import { memberName } from "@/lib/member-name";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/trades/");

function TradedBefore({
  people,
  fromGroupSlug,
}: {
  people: readonly TradesIndexPerson[];
  fromGroupSlug?: string;
}) {
  if (people.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={people.length}>{m.trades_section_traded_before()}</SectionHeading>
      <ul className="flex flex-wrap gap-2">
        {people.map((person) => (
          <li key={person.userId}>
            <Link
              to="/trades/$userId"
              params={{ userId: person.userId }}
              search={{ from: fromGroupSlug }}
              className={buttonVariants({ variant: "outline", className: "rounded-full pl-1" })}
            >
              <UserAvatar
                image={person.image}
                name={person.name}
                gravatarHash={person.gravatarHash}
                size="sm"
              />
              {memberName(person.name)}
              {person.doneCount > 0 ? (
                <span className="text-muted-foreground font-normal">
                  {m.trades_done({ count: person.doneCount })}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoGroupsCallout() {
  return (
    <Callout className="flex flex-wrap items-center gap-3">
      <IconChip icon={UsersIcon} tone="info" size="sm" shape="round" />
      <p className="text-muted-foreground min-w-0 flex-1">{m.trades_empty_description()}</p>
      <Link to="/groups" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {m.trades_go_to_groups()}
      </Link>
    </Callout>
  );
}

export function TradesIndexPage() {
  const { data } = useUserTrades();
  const { data: groupsData } = useFriendGroupsList(true);
  const { group } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const groups = groupsData?.items ?? [];
  const selectedGroup = selectedTradesGroup(groups, group);
  const groupSlug = selectedGroup?.slug ?? null;
  const fromGroupSlug = selectedGroup?.slug;
  const bandGroup = selectedGroup ?? (groups.length === 1 ? groups[0] : undefined);
  const index = buildTradesIndex(tradesInGroup(data?.items ?? [], groupSlug));
  const noGroups = groupsData !== undefined && groups.length === 0;

  return (
    <CardDetailOverlayProvider>
      <PageHero
        width="full"
        title={
          <TradesGroupTitle
            groups={groups}
            groupSlug={groupSlug}
            onGroupChange={(next) => void navigate({ search: { group: next ?? undefined } })}
          />
        }
        lead={m.trades_hero_lead_groups()}
      />

      <div className={cn(PAGE_WIDTH.full, "px-safe flex flex-col gap-10 pt-3 pb-12")}>
        {noGroups ? <NoGroupsCallout /> : null}

        {bandGroup === undefined ? null : (
          <Suspense fallback={null}>
            <ShareYourListsBand slug={bandGroup.slug} groupName={bandGroup.name} />
          </Suspense>
        )}

        <TradesInProgress
          index={index}
          showGroups={index.groupCount > 1}
          fromGroupSlug={fromGroupSlug}
        />

        {noGroups ? null : (
          <Suspense fallback={null}>
            <TradeFinder groupSlug={groupSlug} groupName={selectedGroup?.name} />
          </Suspense>
        )}

        <TradedBefore people={index.past} fromGroupSlug={fromGroupSlug} />
      </div>
    </CardDetailOverlayProvider>
  );
}
