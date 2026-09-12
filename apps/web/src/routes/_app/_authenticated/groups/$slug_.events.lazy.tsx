import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { FriendGroupSectionFrame, isAdmin } from "@/features/groups/components/friend-group-shell";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import { GroupTournamentsLens } from "@/features/tournaments/components/group-tournaments-lens";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/events")({
  component: GroupTournamentsRoute,
});

function GroupTournamentsRoute() {
  const { slug } = Route.useParams();
  const { data } = useFriendGroupDetail(slug);
  const canCreate = isAdmin(data.viewerRole);
  return (
    <FriendGroupSectionFrame
      slug={slug}
      title={m.groups_nav_tournaments()}
      actions={
        canCreate ? (
          <PageTopBarPrimaryButton
            render={<Link to="/tournaments/new" search={{ group: data.group.id }} />}
          >
            <PlusIcon className="size-4" />
            {m.groups_events_new()}
          </PageTopBarPrimaryButton>
        ) : null
      }
      render={() => (
        <GroupTournamentsLens slug={slug} canCreate={canCreate} groupId={data.group.id} />
      )}
    />
  );
}
