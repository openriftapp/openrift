import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    try {
      await remove.mutateAsync(slug);
      void navigate({ to: "/groups" });
    } catch {
      /* Reported by the global mutation error toast. */
    }
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
    <SettingsSection title={m.groups_leave_title()}>
      {isOwner ? (
        <>
          <TransferOwnershipControl data={data} slug={slug} />
          <p className="text-muted-foreground text-sm">{m.groups_leave_owner_note()}</p>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger render={<Button variant="destructive" />}>
              <Trash2Icon className="size-4" />
              {m.groups_leave_delete_group()}
            </DialogTrigger>
            <DialogContent>
              <DialogForm onSubmit={() => void handleDelete()}>
                <DialogHeader>
                  <DialogTitle>{m.groups_leave_confirm_title()}</DialogTitle>
                  <DialogDescription>{m.groups_leave_confirm_description()}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                    {m.common_cancel()}
                  </Button>
                  <Button type="submit" variant="destructive" disabled={remove.isPending}>
                    {m.common_delete()}
                  </Button>
                </DialogFooter>
              </DialogForm>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button variant="ghost" onClick={() => void handleLeave()} disabled={leave.isPending}>
          {m.groups_leave_button()}
        </Button>
      )}
    </SettingsSection>
  );
}
