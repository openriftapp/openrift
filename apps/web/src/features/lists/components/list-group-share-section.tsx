import type { ListIntent } from "@openrift/shared/types/api/list";

import { GroupVisibilitySection } from "@/features/groups/components/group-visibility-section";
import {
  useShareListWithFriendGroup,
  useUnshareListFromFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import { useListGroupShares } from "@/features/lists/hooks/use-list-group-shares";

export function ListGroupShareSection({ listId, intent }: { listId: string; intent: ListIntent }) {
  const { data: groups } = useFriendGroups();
  const { data: sharedWith } = useListGroupShares(listId);
  const share = useShareListWithFriendGroup();
  const unshare = useUnshareListFromFriendGroup();

  return (
    <GroupVisibilitySection
      groups={groups.items}
      sharedGroupIds={new Set(sharedWith.items.map((row) => row.groupId))}
      onShare={(group) => share.mutate({ slug: group.slug, listId })}
      onUnshare={(group) => unshare.mutate({ slug: group.slug, listId })}
      pending={share.isPending || unshare.isPending}
      description={
        intent === "organize"
          ? "Choose which of your friend groups can see this list while signed in."
          : "Choose which of your friend groups can see this list and find trades with you."
      }
      emptyNote="You're not in any friend groups yet. Join or create one to share lists with its members."
      idPrefix="list-group"
    />
  );
}
