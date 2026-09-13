import type { FriendGroupJoinPreviewResponse } from "@openrift/shared/types/api/friend-group";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedOutAuthButtons } from "@/features/account/components/signed-out-cta";
import { useJoinFriendGroupByCode } from "@/features/groups/hooks/use-friend-group-mutations";
import { friendGroupJoinPreviewQueryOptions } from "@/features/groups/hooks/use-friend-groups";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
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
      <Button variant="ghost" render={<Link to="/groups" />}>
        {m.common_cancel()}
      </Button>
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
    <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6", PAGE_PADDING)}>
      <div className="flex flex-col gap-2">
        <Heading level={1}>{m.groups_join_title()}</Heading>
        <p className="text-muted-foreground text-sm">{m.groups_join_subtitle()}</p>
      </div>

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
          <Button variant="ghost" render={<Link to="/groups" />}>
            {m.groups_join_back()}
          </Button>
        </div>
      ) : userId ? (
        <JoinAction code={code} preview={preview.data} previewLoading={preview.isLoading} />
      ) : preview.data ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{m.groups_join_signed_out()}</p>
          <SignedOutAuthButtons signInLabel={m.groups_join_sign_in_label()} />
        </div>
      ) : null}
    </div>
  );
}
