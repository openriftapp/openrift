import { createLazyFileRoute } from "@tanstack/react-router";

import {
  MembersInviteAction,
  MembersPageContent,
  MembersTradedAction,
} from "@/features/groups/components/friend-group-members-page";
import { FriendGroupSectionFrame } from "@/features/groups/components/friend-group-shell";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/members")({
  component: GroupMembersRoute,
});

function GroupMembersRoute() {
  const { slug } = Route.useParams();
  return (
    <FriendGroupSectionFrame
      slug={slug}
      title={m.groups_nav_members()}
      actions={
        <>
          <MembersTradedAction slug={slug} />
          <MembersInviteAction slug={slug} />
        </>
      }
      render={(data) => <MembersPageContent slug={slug} data={data} />}
    />
  );
}
