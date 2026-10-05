import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { Button } from "@/components/ui/button";
import { useDisableFriendGroupCode } from "@/features/groups/hooks/use-friend-group-mutations";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

// The bare code is deliberately not shown: nothing accepts a typed one, only a link.
export function InviteLinkPanel({ slug, code }: { slug: string; code: string }) {
  const disableCode = useDisableFriendGroupCode();

  const joinUrl = `${getSiteUrl()}/groups/join?code=${encodeURIComponent(code)}`;

  return (
    <div className="flex flex-col gap-2">
      <ShareLinkRow
        url={joinUrl}
        label={m.groups_invite_panel_label()}
        defaultQrOpen
        actions={
          <ConfirmActionButton
            trigger={<Button variant="destructive" />}
            onConfirm={() => disableCode.mutateAsync(slug)}
            title={m.groups_invite_disable_title()}
            description={m.groups_invite_disable_description()}
            confirmLabel={m.groups_invite_disable()}
          >
            {m.groups_invite_disable()}
          </ConfirmActionButton>
        }
      />
    </div>
  );
}
