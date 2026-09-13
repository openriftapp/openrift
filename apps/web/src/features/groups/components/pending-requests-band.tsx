import { formatRelativeTime } from "@openrift/shared/format-date";
import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { CheckIcon, UserPlusIcon, XIcon } from "lucide-react";

import { ActionBand } from "@/components/ui/action-band";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { UserAvatar } from "@/components/user-avatar";
import {
  useAcceptFriendGroupInvite,
  useDeclineFriendGroupInvite,
} from "@/features/groups/hooks/use-friend-group-mutations";
import { m } from "@/paraglide/messages.js";

export function PendingRequestsBand({
  slug,
  requests,
}: {
  slug: string;
  requests: FriendGroupDetailResponse["pendingRequests"];
}) {
  const acceptInvite = useAcceptFriendGroupInvite();
  const declineInvite = useDeclineFriendGroupInvite();
  return (
    <ActionBand
      icon={UserPlusIcon}
      accent
      label={m.trades_requests_label()}
      value={requests.length}
      sub={m.trades_requests_waiting({ count: requests.length })}
    >
      <div className="flex flex-col gap-2">
        {requests.map((req) => (
          <Callout key={req.id} variant="inset" className="flex items-center gap-2.5">
            <UserAvatar
              image={req.userImage}
              name={req.userName}
              gravatarHash={req.gravatarHash}
              size="sm"
              className="size-7"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{req.userName ?? m.trades_request_unknown_user()}</span>
              <span className="text-muted-foreground">
                {" "}
                · {m.trades_requested_ago({ time: formatRelativeTime(req.createdAt) })}
              </span>
            </span>
            <Button
              size="sm"
              onClick={() => acceptInvite.mutate({ slug, userId: req.userId })}
              disabled={acceptInvite.isPending}
            >
              <CheckIcon className="size-4" />
              {m.trades_approve()}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => declineInvite.mutate({ slug, userId: req.userId })}
              disabled={declineInvite.isPending}
            >
              <XIcon className="size-4" />
              {m.trades_deny()}
            </Button>
          </Callout>
        ))}
      </div>
    </ActionBand>
  );
}
