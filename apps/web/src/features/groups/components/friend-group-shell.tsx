import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { Button } from "@/components/ui/button";
import { FriendGroupHero } from "@/features/groups/components/friend-group-hero";
import { useDeclineFriendGroupInvite } from "@/features/groups/hooks/use-friend-group-mutations";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import { useRequiredUserId } from "@/hooks/use-session";
import { cn, PAGE_PADDING, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function FriendGroupPageFrame({
  slug,
  render,
}: {
  slug: string;
  render: (data: FriendGroupDetailResponse) => ReactNode;
}) {
  const { data } = useFriendGroupDetail(slug);
  if (data.viewerStatus === "pending") {
    return <PendingApprovalStub data={data} />;
  }
  return (
    <>
      <FriendGroupHero slug={slug} data={data} />
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-6", PAGE_PADDING_NO_TOP)}>
        {render(data)}
      </div>
    </>
  );
}

export function FriendGroupSectionFrame({
  slug,
  title,
  actions,
  render,
}: {
  slug: string;
  title: string;
  actions?: ReactNode;
  render: (data: FriendGroupDetailResponse) => ReactNode;
}) {
  const { data } = useFriendGroupDetail(slug);
  if (data.viewerStatus === "pending") {
    return <PendingApprovalStub data={data} />;
  }
  return (
    <TopBarBreadcrumbBar
      segments={[{ label: data.group.name, link: <Link to="/groups/$slug" params={{ slug }} /> }]}
      title={title}
      actions={actions}
    >
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        {render(data)}
      </div>
    </TopBarBreadcrumbBar>
  );
}

function PendingApprovalStub({ data }: { data: FriendGroupDetailResponse }) {
  const viewerId = useRequiredUserId();
  const declineInvite = useDeclineFriendGroupInvite();
  const navigate = useNavigate();

  async function handleCancel() {
    try {
      await declineInvite.mutateAsync({ slug: data.group.slug, userId: viewerId });
      void navigate({ to: "/groups" });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className={cn(PAGE_WIDTH.capped, "flex flex-col items-center gap-6", PAGE_PADDING)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Heading level={1}>{data.group.name}</Heading>
        <p className="text-muted-foreground">{m.groups_pending_approval()}</p>
      </div>
      <Button
        variant="ghost"
        onClick={() => void handleCancel()}
        disabled={declineInvite.isPending}
      >
        {m.groups_cancel_request()}
      </Button>
    </div>
  );
}
