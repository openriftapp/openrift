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
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import { useDisableFriendGroupCode } from "@/features/groups/hooks/use-friend-group-mutations";
import { getSiteUrl } from "@/lib/site-config";

// The bare code is deliberately not shown: nothing accepts a typed one, only a link.
export function InviteLinkPanel({ slug, code }: { slug: string; code: string }) {
  const disableCode = useDisableFriendGroupCode();
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);

  const joinUrl = `${getSiteUrl()}/groups/join?code=${encodeURIComponent(code)}`;

  async function handleDisable() {
    try {
      await disableCode.mutateAsync(slug);
      setDisableConfirmOpen(false);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ShareLinkRow
        url={joinUrl}
        label="Group invite link"
        defaultQrOpen
        actions={
          <Dialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
            <DialogTrigger render={<Button variant="destructive" />}>Disable</DialogTrigger>
            <DialogContent>
              <DialogForm onSubmit={() => void handleDisable()}>
                <DialogHeader>
                  <DialogTitle>Turn off invites?</DialogTitle>
                  <DialogDescription>
                    The current link stops working immediately. Turning invites back on creates a
                    different link.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDisableConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="destructive" disabled={disableCode.isPending}>
                    Disable
                  </Button>
                </DialogFooter>
              </DialogForm>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}
