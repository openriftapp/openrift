import type { FriendGroupCollectionShareResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { FolderIcon } from "lucide-react";

import { IconChip } from "@/components/ui/icon-chip";
import { RowListLink } from "@/components/ui/row-list";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { m } from "@/paraglide/messages.js";

export function SharedCollectionRow({
  slug,
  share,
}: {
  slug: string;
  share: FriendGroupCollectionShareResponse;
}) {
  return (
    <RowListLink
      render={
        <Link
          to="/groups/$slug/collections/$collectionId"
          params={{ slug, collectionId: share.collectionId }}
          search={(prev) => prev}
        />
      }
    >
      <IconChip icon={FolderIcon} tone="info" size="sm" shape="round" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{share.collectionName}</span>
        <span className="text-muted-foreground truncate text-xs">
          {m.common_copies({ count: share.copyCount })}
        </span>
      </span>
      {share.coverPrintings.length > 0 ? (
        <CardArtThumbStack
          items={share.coverPrintings.map((cover) => ({
            key: cover.printingId,
            imageId: cover.imageId,
          }))}
          max={3}
          className="shrink-0"
          thumbClassName="ring-card w-7"
        />
      ) : null}
    </RowListLink>
  );
}
