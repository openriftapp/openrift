import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { DangerZone } from "@/components/layout/danger-zone";
import { Button } from "@/components/ui/button";
import { TransferOwnershipControl } from "@/features/groups/components/transfer-ownership-control";
import {
  useDeleteFriendGroup,
  useLeaveFriendGroup,
} from "@/features/groups/hooks/use-friend-group-mutations";
import { m } from "@/paraglide/messages.js";

export function LeaveOrDeletePanel({
  data,
  slug,
}: {
  data: FriendGroupDetailResponse;
  slug: string;
}) {
  const navigate = useNavigate();
  const leave = useLeaveFriendGroup();
  const remove = useDeleteFriendGroup();
  const isOwner = data.viewerRole === "owner";

  async function handleDelete() {
    await remove.mutateAsync(slug);
    void navigate({ to: "/groups" });
  }

  async function handleLeave() {
    try {
      await leave.mutateAsync(slug);
      void navigate({ to: "/groups" });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <DangerZone
      title={m.groups_leave_title()}
      description={isOwner ? m.groups_leave_owner_note() : undefined}
      contentClassName={isOwner ? "flex flex-col items-start gap-4" : undefined}
    >
      {isOwner ? (
        <>
          <TransferOwnershipControl data={data} slug={slug} />
          <ConfirmActionButton
            trigger={<Button variant="destructive" />}
            onConfirm={handleDelete}
            title={m.groups_leave_confirm_title()}
            description={m.groups_leave_confirm_description()}
            confirmLabel={m.common_delete()}
          >
            <Trash2Icon className="size-4" />
            {m.groups_leave_delete_group()}
          </ConfirmActionButton>
        </>
      ) : (
        <Button variant="outline" pending={leave.isPending} onClick={() => void handleLeave()}>
          {m.groups_leave_button()}
        </Button>
      )}
    </DangerZone>
  );
}
