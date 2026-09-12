import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useGroupTrades, useUserTrades } from "@/features/groups/hooks/use-card-trades";
import {
  useFriendGroupMatches,
  useFriendGroupMatchesForSlugs,
  useFriendGroups,
} from "@/features/groups/hooks/use-friend-groups";
import { buildTradeHubCards } from "@/features/groups/lib/trade-hub";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

import { ShareYourListsBand, TradeHubMemberCard } from "./trade-hub";

export function TradesPageContent({
  slug,
  data,
}: {
  slug: string;
  data: FriendGroupDetailResponse;
}) {
  return (
    <div className="flex flex-col gap-8">
      <TradeHub slug={slug} data={data} />
      <Suspense fallback={null}>
        <ShareYourListsBand slug={slug} groupName={data.group.name} />
      </Suspense>
    </div>
  );
}

function TradeHub({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const viewerId = useRequiredUserId();
  const { data: matches } = useFriendGroupMatches(slug);
  const { data: tradesData } = useGroupTrades(data.group.id);
  const { data: allTradesData } = useUserTrades();
  // The member card opens a person-level sheet pooling every shared group,
  // so matches from other groups are read here too.
  const { data: groups } = useFriendGroups();
  const elsewhere = useFriendGroupMatchesForSlugs(
    groups.items.filter((group) => group.slug !== slug).map((group) => group.slug),
  );

  const trades = tradesData?.items ?? [];
  const cards = buildTradeHubCards({
    viewerId,
    groupId: data.group.id,
    members: data.members,
    groupTrades: trades,
    // Falls back to the group's own trades until the all-groups list loads.
    allTrades: allTradesData?.items ?? trades,
    incoming: matches.othersHaveYourWants,
    outgoing: matches.othersWantYourHaves,
    elsewhereIncoming: elsewhere.othersHaveYourWants,
    elsewhereOutgoing: elsewhere.othersWantYourHaves,
    shares: data.shares,
  });

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title={m.trades_invite_title()}
        description={m.trades_invite_description()}
      >
        <Button render={<Link to="/groups/$slug/members" params={{ slug }} />}>
          {m.trades_view_members()}
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <TradeHubMemberCard key={card.member.userId} card={card} slug={slug} />
      ))}
    </div>
  );
}
