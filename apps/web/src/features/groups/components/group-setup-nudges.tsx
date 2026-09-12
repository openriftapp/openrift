import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import type { GroupNudgeKind } from "@/features/account/stores/onboarding-store";
import { groupNudgeKey, useOnboardingStore } from "@/features/account/stores/onboarding-store";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

/** Empty when the viewer isn't in data.members yet (still loading, or not a member). */
export function pendingGroupNudges(
  data: FriendGroupDetailResponse,
  viewerId: string,
): GroupNudgeKind[] {
  const self = data.members.find((member) => member.userId === viewerId);
  if (!self) {
    return [];
  }
  const nudges: GroupNudgeKind[] = [];
  if (self.contactMethods.length === 0) {
    nudges.push("contacts");
  }
  if (!data.shares.some((share) => share.userId === viewerId)) {
    nudges.push("lists");
  }
  return nudges;
}

interface NudgeCopy {
  title: string;
  description: string;
  hash: string;
  actionLabel: string;
  helpLabel: string;
}

function nudgeCopy(kind: GroupNudgeKind): NudgeCopy {
  if (kind === "contacts") {
    return {
      title: m.groups_nudge_contacts_title(),
      description: m.groups_nudge_contacts_description(),
      hash: "contacts",
      actionLabel: m.groups_nudge_contacts_action(),
      helpLabel: m.groups_nudge_contacts_help(),
    };
  }
  return {
    title: m.groups_nudge_lists_title(),
    description: m.groups_nudge_lists_description(),
    hash: "lists",
    actionLabel: m.groups_nudge_lists_action(),
    helpLabel: m.groups_nudge_lists_help(),
  };
}

export function GroupSetupNudges({
  slug,
  data,
}: {
  slug: string;
  data: FriendGroupDetailResponse;
}) {
  const viewerId = useRequiredUserId();
  const dismissed = useOnboardingStore((state) => state.dismissedGroupNudges);
  const dismiss = useOnboardingStore((state) => state.dismissGroupNudge);

  const kinds = pendingGroupNudges(data, viewerId).filter(
    (kind) => !dismissed.includes(groupNudgeKey(slug, kind)),
  );
  if (kinds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {kinds.map((kind) => {
        const copy = nudgeCopy(kind);
        return (
          <Callout key={kind} className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">{copy.title}</span> {copy.description}
              </p>
              <p className="text-muted-foreground text-sm">
                <TextLink render={<Link to="/help/$slug" params={{ slug: "groups" }} />}>
                  {copy.helpLabel}
                </TextLink>
              </p>
            </div>
            <div className="-my-1 flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                render={<Link to="/groups/$slug/manage" params={{ slug }} hash={copy.hash} />}
              >
                {copy.actionLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => dismiss(slug, kind)}
                aria-label={m.groups_nudge_dismiss({ title: copy.title })}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </Callout>
        );
      })}
    </div>
  );
}
