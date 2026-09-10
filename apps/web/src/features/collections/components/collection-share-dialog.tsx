import { CatchBoundary } from "@tanstack/react-router";
import { Suspense } from "react";

import { useCollectionGroupShares } from "@/features/collections/hooks/use-collection-group-shares";
import {
  useShareCollection,
  useUnshareCollection,
} from "@/features/collections/hooks/use-collections";
import { GroupVisibilitySection } from "@/features/groups/components/group-visibility-section";
import { ShareDialog } from "@/features/groups/components/share-dialog";
import {
  useShareCollectionWithFriendGroup,
  useUnshareCollectionFromFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import { collectionOwnerImageUrl, shareImageOptions } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";

interface CollectionShareDialogProps {
  collectionId: string;
  collectionName: string;
  isPublic: boolean;
  shareToken: string | null;
  isGroupCollection: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionShareDialog({
  collectionId,
  collectionName,
  isPublic,
  shareToken,
  isGroupCollection,
  open,
  onOpenChange,
}: CollectionShareDialogProps) {
  const shareCollection = useShareCollection();
  const unshareCollection = useUnshareCollection();

  const shareUrl = shareLinkUrl("collection", { shareToken, isPublic });

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share collection"
      noun="collection"
      link={{
        url: shareUrl,
        label: "Collection share link",
        exposes: "view this collection, including the card list and its total value",
        unfurls: true,
        onCreate: () => shareCollection.mutate(collectionId),
        creating: shareCollection.isPending,
        onStop: () => unshareCollection.mutate(collectionId),
        stopping: unshareCollection.isPending,
      }}
      access={
        // groupShares 404s for a pooled collection; the boundary scopes that to this panel.
        isGroupCollection ? null : (
          <CatchBoundary getResetKey={() => collectionId} errorComponent={() => null}>
            <Suspense fallback={null}>
              <CollectionGroupShareSection collectionId={collectionId} />
            </Suspense>
          </CatchBoundary>
        )
      }
      image={{
        title: collectionName,
        filenameBase: collectionName || "collection",
        buildUrl: (choice) =>
          collectionOwnerImageUrl(getSiteUrl(), collectionId, shareImageOptions(choice)),
        scales: [1, 2],
        qrNoun: "collection",
        qrAvailable: shareUrl !== null,
      }}
      qrFilenameBase={collectionName || "collection"}
      print={{
        defaultTitle: collectionName,
        defaultSubtitle: "Scan to see my collection",
        filenameHint: collectionName,
      }}
    />
  );
}

function CollectionGroupShareSection({ collectionId }: { collectionId: string }) {
  const { data: groups } = useFriendGroups();
  const { data: sharedWith } = useCollectionGroupShares(collectionId);
  const share = useShareCollectionWithFriendGroup();
  const unshare = useUnshareCollectionFromFriendGroup();

  return (
    <GroupVisibilitySection
      groups={groups.items}
      sharedGroupIds={new Set(sharedWith.items.map((row) => row.groupId))}
      onShare={(group) => share.mutate({ slug: group.slug, collectionId })}
      onUnshare={(group) => unshare.mutate({ slug: group.slug, collectionId })}
      pending={share.isPending || unshare.isPending}
      description="Choose which of your friend groups can see this collection (read-only) while signed in."
      emptyNote="You're not in any friend groups yet. Join or create one to share collections with its members."
      idPrefix="collection-group"
    />
  );
}
