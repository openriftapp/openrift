import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { CrownIcon } from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransferFriendGroupOwnership } from "@/features/groups/hooks/use-friend-group-mutations";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export function TransferOwnershipControl({
  data,
  slug,
}: {
  data: FriendGroupDetailResponse;
  slug: string;
}) {
  const viewerId = useRequiredUserId();
  const transfer = useTransferFriendGroupOwnership();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const candidates = data.members.filter((member) => member.userId !== viewerId);
  if (candidates.length === 0) {
    return null;
  }
  const items = candidates.map((member) => ({
    value: member.userId,
    label: member.userName ?? m.groups_unknown_user(),
  }));
  const target = candidates.find((member) => member.userId === targetId);

  async function handleTransfer() {
    if (!target) {
      return;
    }
    try {
      await transfer.mutateAsync({ slug, userId: target.userId });
      setConfirmOpen(false);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2">
        <CrownIcon className="size-4" />
        {m.groups_transfer_title()}
      </Label>
      <p className="text-muted-foreground text-sm">{m.groups_transfer_description()}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select items={items} value={targetId} onValueChange={(value) => setTargetId(value)}>
          <SelectTrigger className="w-56" aria-label={m.groups_transfer_select_aria()}>
            <SelectValue placeholder={m.groups_transfer_placeholder()} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger render={<Button variant="outline" disabled={target === undefined} />}>
            {m.groups_transfer_title()}
          </DialogTrigger>
          <DialogContent>
            <DialogForm onSubmit={() => void handleTransfer()}>
              <DialogHeader>
                <DialogTitle>
                  {m.groups_transfer_confirm_title({
                    member: target?.userName ?? m.groups_this_member(),
                  })}
                </DialogTitle>
                <DialogDescription>{m.groups_transfer_confirm_description()}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  {m.common_cancel()}
                </Button>
                <Button type="submit" variant="destructive" disabled={transfer.isPending}>
                  {m.groups_transfer_button()}
                </Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
