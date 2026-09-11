import { BookOpenIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Checkbox } from "@/components/ui/checkbox";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  useFriendGroupShareableCollections,
  useShareCollectionWithFriendGroup,
  useUnshareCollectionFromFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";

export function ShareableCollectionsPanel({ slug }: { slug: string }) {
  const { data } = useFriendGroupShareableCollections(slug);
  const share = useShareCollectionWithFriendGroup();
  const unshare = useUnshareCollectionFromFriendGroup();

  if (data.items.length === 0) {
    return (
      <SettingsSection
        id="collections"
        className="scroll-mt-28"
        title="Share your collections"
        description="You don't have any personal collections yet. Create one to share it with this group."
      />
    );
  }
  return (
    <SettingsSection
      id="collections"
      className="scroll-mt-28"
      title="Share your collections"
      description="Visible (read-only) to everyone in this group."
    >
      <RowList>
        {data.items.map((row) => {
          const isShared = row.sharedAt !== null;
          return (
            <RowListItem key={row.collectionId}>
              <Checkbox
                checked={isShared}
                onCheckedChange={(checked) => {
                  if (checked) {
                    share.mutate({ slug, collectionId: row.collectionId });
                  } else {
                    unshare.mutate({ slug, collectionId: row.collectionId });
                  }
                }}
                disabled={share.isPending || unshare.isPending}
              />
              <div className="flex items-center gap-2">
                <BookOpenIcon className="size-4" />
                <span className="font-medium">{row.collectionName}</span>
              </div>
            </RowListItem>
          );
        })}
      </RowList>
    </SettingsSection>
  );
}
