import type { FriendGroupJoinPreviewResponse } from "@openrift/shared/types/api/friend-group";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  PageDescription,
  PageTopBar,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { MarkdownText } from "@/components/markdown-text";
import { SignedOutAuthButtons } from "@/components/signed-out-cta";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useJoinFriendGroupByCode } from "@/features/groups/hooks/use-friend-group-mutations";
import { friendGroupJoinPreviewQueryOptions } from "@/features/groups/hooks/use-friend-groups";
import { useUserId } from "@/hooks/use-session";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface GroupsJoinPageProps {
  code?: string;
}

/** Split out because useJoinFriendGroupByCode requires a signed-in user and this page doesn't. */
function JoinAction({
  code,
  preview,
  previewLoading,
}: {
  code: string;
  preview?: FriendGroupJoinPreviewResponse;
  previewLoading: boolean;
}) {
  const navigate = useNavigate();
  const joinByCode = useJoinFriendGroupByCode();

  async function handleSubmit() {
    if (!code) {
      return;
    }
    if (preview?.viewerStatus === "member") {
      void navigate({ to: "/groups/$slug", params: { slug: preview.slug } });
      return;
    }
    const joinedSlug = preview?.slug;
    try {
      await joinByCode.mutateAsync(code);
      if (joinedSlug) {
        void navigate({ to: "/groups/$slug", params: { slug: joinedSlug } });
      } else {
        void navigate({ to: "/groups" });
      }
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="flex justify-between gap-3">
      <Link to="/groups" className={buttonVariants({ variant: "ghost" })}>
        {m.common_cancel()}
      </Link>
      <Button
        onClick={() => void handleSubmit()}
        disabled={!code || previewLoading || joinByCode.isPending}
      >
        {preview?.viewerStatus === "member"
          ? m.groups_join_open_group()
          : preview?.viewerStatus === "pending"
            ? m.groups_join_already_requested()
            : m.groups_join_request()}
      </Button>
    </div>
  );
}

export function GroupsJoinPage({ code = "" }: GroupsJoinPageProps) {
  const userId = useUserId();
  const preview = useQuery(friendGroupJoinPreviewQueryOptions(code));
  const deadLink = !code || preview.isError;

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarBack to="/groups" aria-label={m.groups_join_back()} />
          <PageTopBarTitle>{m.groups_join_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-6 pt-3 pb-12")}>
        <PageDescription>{m.groups_join_subtitle()}</PageDescription>

        {deadLink ? (
          <Card>
            <CardHeader>
              <CardTitle>{m.groups_join_dead_title()}</CardTitle>
              <CardDescription>{m.groups_join_dead_description()}</CardDescription>
            </CardHeader>
          </Card>
        ) : preview.data ? (
          <Card>
            <CardHeader>
              <CardTitle>{preview.data.name}</CardTitle>
              <CardDescription>
                {m.groups_member_count({ count: preview.data.memberCount })}
              </CardDescription>
            </CardHeader>
            {preview.data.description ? (
              <CardContent>
                <MarkdownText
                  text={preview.data.description}
                  links="labeled"
                  className="text-muted-foreground text-sm"
                />
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {deadLink ? (
          <div className="flex justify-start">
            <Link to="/groups" className={buttonVariants({ variant: "ghost" })}>
              {m.groups_join_back()}
            </Link>
          </div>
        ) : userId ? (
          <JoinAction code={code} preview={preview.data} previewLoading={preview.isLoading} />
        ) : preview.data ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">{m.groups_join_signed_out()}</p>
            <SignedOutAuthButtons source="group-join" signInLabel={m.groups_join_sign_in_label()} />
          </div>
        ) : null}
      </div>
    </>
  );
}
