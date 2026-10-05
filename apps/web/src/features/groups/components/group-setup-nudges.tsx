import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";

import { NudgeCallout } from "@/components/nudge-callout";
import { buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { useRequiredUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";
import type { GroupNudgeKind } from "@/stores/onboarding-store";
import { groupNudgeKey, useOnboardingStore } from "@/stores/onboarding-store";

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
          <NudgeCallout
            key={kind}
            title={copy.title}
            body={copy.description}
            action={
              <Link
                to="/groups/$slug/manage"
                params={{ slug }}
                hash={copy.hash}
                className={buttonVariants({ size: "sm" })}
              >
                {copy.actionLabel}
              </Link>
            }
            onDismiss={() => dismiss(slug, kind)}
            dismissLabel={m.groups_nudge_dismiss({ title: copy.title })}
          >
            <TextLink render={<Link to="/help/$slug" params={{ slug: "groups" }} />}>
              {copy.helpLabel}
            </TextLink>
          </NudgeCallout>
        );
      })}
    </div>
  );
}
