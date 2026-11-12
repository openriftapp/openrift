import type {
  FriendGroupMemberResponse,
  FriendGroupShareResponse,
} from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";

import { cardLinkVariants } from "@/components/ui/card-link";
import { CardRow } from "@/components/ui/card-list";
import { UserAvatar } from "@/components/user-avatar";
import { LIST_INTENT_ICON, listIntentLabel, listKindNoun } from "@/lib/list-intent";
import { memberName } from "@/lib/member-name";
import { cn } from "@/lib/utils";

export function SharedListRow({
  slug,
  member,
  share,
  showMember = true,
}: {
  slug: string;
  member: FriendGroupMemberResponse;
  share: FriendGroupShareResponse;
  showMember?: boolean;
}) {
  const IntentIcon = LIST_INTENT_ICON[share.listIntent];
  const noun = listKindNoun(share.listKind, share.entryCount);
  return (
    <CardRow className={cn(cardLinkVariants(), "relative gap-3")}>
      <IntentIcon className="text-muted-foreground size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to="/groups/$slug/lists/$listId"
          params={{ slug, listId: share.listId }}
          search={{ fromUser: share.userId }}
          className="font-medium before:absolute before:inset-0 before:content-['']"
        >
          <span className="block truncate">{share.listName}</span>
        </Link>
        <span className="text-muted-foreground text-xs">
          {listIntentLabel(share.listIntent)} · {share.entryCount} {noun}
        </span>
      </div>
      {showMember ? (
        <Link
          to="/groups/$slug/members/$userId"
          params={{ slug, userId: member.userId }}
          className="hover:bg-muted relative z-10 flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1"
        >
          <UserAvatar
            image={member.userImage}
            name={member.userName}
            gravatarHash={member.gravatarHash}
            size="sm"
          />
          <span className="hidden text-sm sm:inline">{memberName(member.userName)}</span>
        </Link>
      ) : null}
    </CardRow>
  );
}
