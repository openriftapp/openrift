import { formatRelativeTime } from "@openrift/shared/format-date";
import type { PublicUserBundleListResponse } from "@openrift/shared/types/api/user-share";
import { Link } from "@tanstack/react-router";
import { CheckIcon, ChevronRightIcon, GlobeIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardLink } from "@/components/ui/card-link";
import { UserProfilePreviewFan } from "@/features/groups/components/user-profile-preview-fan";
import { listEntryCountLabel } from "@/features/lists/lib/list-entry-count";

function matchLabel(list: PublicUserBundleListResponse): string | null {
  if (list.matchCount === null || list.matchCount === 0) {
    return null;
  }
  const where = list.intent === "wish" ? "in your tradelists" : "on your wishlists";
  return `${list.matchCount} ${where}`;
}

export function UserProfileListTile({
  token,
  list,
  showVisibility,
}: {
  token: string;
  list: PublicUserBundleListResponse;
  showVisibility: boolean;
}) {
  const match = matchLabel(list);
  return (
    <CardLink
      className="gap-2 p-4"
      render={<Link to="/users/share/$token/lists/$listId" params={{ token, listId: list.id }} />}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 font-medium break-words">{list.name}</span>
        <ChevronRightIcon className="text-muted-foreground/40 mt-0.5 size-4 shrink-0" />
      </div>
      {showVisibility ? (
        <div className="flex flex-wrap gap-1.5">
          <VisibilityBadges list={list} />
        </div>
      ) : null}
      <div className="mt-auto flex items-end justify-between gap-4 pt-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="whitespace-nowrap">
            {listEntryCountLabel(list.kind, list.entryCount)} · Updated{" "}
            {formatRelativeTime(list.updatedAt)}
          </span>
          {match ? (
            <span className="text-success inline-flex items-center gap-1 whitespace-nowrap">
              <CheckIcon className="size-3" />
              {match}
            </span>
          ) : null}
        </div>
        <UserProfilePreviewFan imageIds={list.previewImageIds} />
      </div>
    </CardLink>
  );
}

function VisibilityBadges({ list }: { list: PublicUserBundleListResponse }) {
  return (
    <>
      {list.isPublic ? (
        <Badge variant="outline" className="text-2xs gap-1" title="Has a public share link">
          <GlobeIcon className="size-3" />
          Public
        </Badge>
      ) : null}
      {list.viaGroups.map((group) => (
        <Badge
          key={group.id}
          variant="outline"
          className="text-2xs max-w-[10rem] gap-1"
          title={`Shared with ${group.name}`}
        >
          <UsersIcon className="size-3 shrink-0" />
          <span className="truncate">{group.name}</span>
        </Badge>
      ))}
    </>
  );
}
