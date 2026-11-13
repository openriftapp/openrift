import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";

import { TextLink } from "@/components/ui/text-link";
import {
  ShareWithGroupDialog,
  ShareWithGroupPicker,
} from "@/features/groups/components/share-with-group-dialog";
import {
  useFriendGroupShareableCollections,
  useShareCollectionWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { m } from "@/paraglide/messages.js";

export function ShareCollectionsWithGroupDialog({
  slug,
  groupName,
  open,
  onOpenChange,
}: {
  slug: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ShareWithGroupDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.share_collections_dialog_title({ group: groupName })}
      description={m.share_collections_dialog_description()}
      loadingLabel={m.share_collections_dialog_loading()}
    >
      <ShareCollectionsBody slug={slug} onOpenChange={onOpenChange} />
    </ShareWithGroupDialog>
  );
}

function ShareCollectionsBody({
  slug,
  onOpenChange,
}: {
  slug: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useFriendGroupShareableCollections(slug);
  const share = useShareCollectionWithFriendGroup();
  const candidates = data.items.filter((item) => item.sharedAt === null);

  return (
    <ShareWithGroupPicker
      items={candidates.map((item) => ({
        id: item.collectionId,
        name: item.collectionName,
        icon: BookOpenIcon,
      }))}
      flow="manage"
      idPrefix="share-collection"
      emptyMessage={
        data.items.length === 0 ? (
          <ParaglideMessage
            message={m.share_collections_dialog_none}
            markup={{
              link: ({ children }) => (
                <TextLink variant="muted" render={<Link to="/collections" />}>
                  {children}
                </TextLink>
              ),
            }}
          />
        ) : (
          m.share_collections_dialog_all_shared()
        )
      }
      submitLabel={(count) => m.share_collections_dialog_submit({ count })}
      isPending={share.isPending}
      onShare={(ids) =>
        Promise.allSettled(ids.map((collectionId) => share.mutateAsync({ slug, collectionId })))
      }
      onOpenChange={onOpenChange}
    />
  );
}
