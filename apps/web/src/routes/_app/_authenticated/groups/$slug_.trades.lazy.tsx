import { createLazyFileRoute } from "@tanstack/react-router";

import { FriendGroupSectionFrame } from "@/features/groups/components/friend-group-shell";
import { TradesPageContent } from "@/features/groups/components/friend-group-trades-page";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/trades")({
  component: GroupTradesRoute,
});

function GroupTradesRoute() {
  const { slug } = Route.useParams();
  return (
    <FriendGroupSectionFrame
      slug={slug}
      title={m.groups_nav_trades()}
      render={(data) => <TradesPageContent slug={slug} data={data} />}
    />
  );
}
