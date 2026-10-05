import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { CrownIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransferFriendGroupOwnership } from "@/features/groups/hooks/use-friend-group-mutations";
import { useRequiredUserId } from "@/hooks/use-session";
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
    if (target) {
      await transfer.mutateAsync({ slug, userId: target.userId });
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
        <ConfirmActionButton
          trigger={<Button variant="outline" />}
          disabled={target === undefined}
          onConfirm={handleTransfer}
          title={m.groups_transfer_confirm_title({
            member: target?.userName ?? m.groups_this_member(),
          })}
          description={m.groups_transfer_confirm_description()}
          confirmLabel={m.groups_transfer_button()}
        >
          {m.groups_transfer_title()}
        </ConfirmActionButton>
      </div>
    </div>
  );
}
