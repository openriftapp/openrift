import { isGroupAdminRole } from "@openrift/shared/friend-group-roles";
import { Link, getRouteApi } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CalendarFeedButton } from "@/features/groups/components/calendar-feed-dialog";
import { FriendGroupSectionFrame } from "@/features/groups/components/friend-group-shell";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import { GroupTournamentsLens } from "@/features/tournaments/components/group-tournaments-lens";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/groups/$slug_/events");

export function GroupTournamentsPage() {
  const { slug } = routeApi.useParams();
  const { data } = useFriendGroupDetail(slug);
  const canCreate = isGroupAdminRole(data.viewerRole);
  return (
    <FriendGroupSectionFrame
      slug={slug}
      title={m.groups_nav_tournaments()}
      actions={
        <>
          <CalendarFeedButton slug={slug} kind="tournaments" />
          {canCreate ? (
            <Link
              to="/tournaments/new"
              search={{ group: data.group.id }}
              className={buttonVariants()}
            >
              <PlusIcon className="size-4" />
              {m.groups_events_new()}
            </Link>
          ) : null}
        </>
      }
      render={() => (
        <GroupTournamentsLens slug={slug} canCreate={canCreate} groupId={data.group.id} />
      )}
    />
  );
}
