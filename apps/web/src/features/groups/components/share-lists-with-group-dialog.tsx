import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { HandshakeIcon, HeartIcon } from "lucide-react";

import { TextLink } from "@/components/ui/text-link";
import type { ShareWithGroupFlow } from "@/features/groups/components/share-with-group-dialog";
import {
  ShareWithGroupDialog,
  ShareWithGroupPicker,
} from "@/features/groups/components/share-with-group-dialog";
import {
  useFriendGroupShareableLists,
  useShareListWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { m } from "@/paraglide/messages.js";

export function ShareListsWithGroupDialog({
  slug,
  groupName,
  open,
  onOpenChange,
  flow,
}: {
  slug: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: ShareWithGroupFlow;
}) {
  return (
    <ShareWithGroupDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.share_lists_dialog_title({ group: groupName })}
      description={m.share_lists_dialog_description()}
      loadingLabel={m.share_lists_dialog_loading()}
    >
      <ShareListsBody slug={slug} onOpenChange={onOpenChange} flow={flow} />
    </ShareWithGroupDialog>
  );
}

function ShareListsBody({
  slug,
  onOpenChange,
  flow,
}: {
  slug: string;
  onOpenChange: (open: boolean) => void;
  flow: ShareWithGroupFlow;
}) {
  const { data } = useFriendGroupShareableLists(slug);
  const share = useShareListWithFriendGroup();

  const tradableLists = data.items.filter(
    (item) => item.listIntent === "wish" || item.listIntent === "trade",
  );
  const candidates = tradableLists.filter((item) => item.sharedAt === null);

  return (
    <ShareWithGroupPicker
      items={candidates.map((item) => ({
        id: item.listId,
        name: item.listName,
        icon: item.listIntent === "wish" ? HeartIcon : HandshakeIcon,
        detail: m.common_cards({ count: item.entryCount }),
      }))}
      flow={flow}
      idPrefix="share-list"
      emptyMessage={
        tradableLists.length === 0 ? (
          <ParaglideMessage
            message={m.share_lists_dialog_none}
            markup={{
              link: ({ children }) => (
                <TextLink variant="muted" render={<Link to="/collections" />}>
                  {children}
                </TextLink>
              ),
            }}
          />
        ) : (
          m.share_lists_dialog_all_shared()
        )
      }
      submitLabel={(count) => m.share_lists_dialog_submit({ count })}
      isPending={share.isPending}
      onShare={(ids) =>
        Promise.allSettled(ids.map((listId) => share.mutateAsync({ slug, listId })))
      }
      onOpenChange={onOpenChange}
    />
  );
}
