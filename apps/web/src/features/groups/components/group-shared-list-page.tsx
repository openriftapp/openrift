import type { PublicListDetailResponse } from "@openrift/shared/types/api/list";
import { Link, getRouteApi } from "@tanstack/react-router";

import { TopBarBreadcrumbTrail } from "@/components/layout/top-bar-breadcrumb";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { useFriendGroupSharedList } from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import type { ListExchangeContext } from "@/features/lists/components/shared-list-content";
import { SharedListContent } from "@/features/lists/components/shared-list-content";
import { useRequiredUserId } from "@/hooks/use-session";
import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/groups/$slug_/lists/$listId");

export function GroupSharedListPage() {
  const { slug, listId } = routeApi.useParams();
  const viewerId = useRequiredUserId();
  const { data } = useFriendGroupSharedList(slug, listId);
  const { data: groupDetail } = useFriendGroupDetail(slug);
  const search = routeApi.useSearch();
  const { fromUser } = search;

  // "Want"/"Offer" only apply on another member's trade/wish list, never
  // your own list or an organize list.
  const isOtherMembersList = data.list.ownerUserId !== viewerId;
  const exchange: ListExchangeContext | undefined =
    isOtherMembersList && (data.list.intent === "trade" || data.list.intent === "wish")
      ? {
          mode: data.list.intent === "trade" ? "request" : "offer",
          groupSlug: slug,
          groupName: groupDetail.group.name,
          counterpartyUserId: data.list.ownerUserId,
          counterpartyName: memberName(data.list.ownerName),
        }
      : undefined;

  // The friend-group endpoint omits createdAt/updatedAt and nests the owner
  // inside `list`; projected here into the shape SharedListContent expects.
  const publicShape: PublicListDetailResponse = {
    list: {
      id: data.list.id,
      name: data.list.name,
      intent: data.list.intent,
      kind: data.list.kind,
      tradeDefaults: data.list.tradeDefaults,
      currency: data.list.currency,
      createdAt: "",
      updatedAt: "",
    },
    entries: data.entries,
    owner: { displayName: memberName(data.list.ownerName), gravatarHash: null },
  };

  const groupCrumb = {
    label: groupDetail.group.name,
    link: <Link to="/groups/$slug" params={{ slug }} />,
  };
  const fromMemberName = fromUser
    ? memberName(groupDetail.members.find((member) => member.userId === fromUser)?.userName)
    : null;
  const backLink = (
    <TopBarBreadcrumbTrail
      segments={
        fromUser
          ? [
              groupCrumb,
              {
                label: m.groups_nav_members(),
                link: <Link to="/groups/$slug/members" params={{ slug }} />,
              },
              {
                label: fromMemberName ?? memberName(null),
                link: (
                  <Link to="/groups/$slug/members/$userId" params={{ slug, userId: fromUser }} />
                ),
              },
            ]
          : [
              groupCrumb,
              {
                label: m.groups_nav_trades(),
                link: <Link to="/groups/$slug/trades" params={{ slug }} />,
              },
            ]
      }
    />
  );

  return (
    <FilterSearchProvider value={search}>
      <SharedListContent data={publicShape} backLink={backLink} exchange={exchange} />
    </FilterSearchProvider>
  );
}
