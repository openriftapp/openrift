import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { FriendGroupShareableListResponse } from "@openrift/shared/types/api/friend-group";
import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import { Link } from "@tanstack/react-router";
import { FolderIcon, HandshakeIcon, HeartIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
import {
  useFriendGroupShareableLists,
  useShareListWithFriendGroup,
  useUnshareListFromFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { LIST_KIND_ICON } from "@/features/lists/components/create-list-dialog";
import { m } from "@/paraglide/messages.js";

const INTENT_LABEL: Record<ListIntent, () => string> = {
  wish: () => m.share_intent_wish(),
  trade: () => m.share_intent_trade(),
  organize: () => m.share_intent_organize(),
};

const INTENT_ICON: Record<ListIntent, ComponentType<SVGProps<SVGSVGElement>>> = {
  wish: HeartIcon,
  trade: HandshakeIcon,
  organize: FolderIcon,
};

const KIND_COUNT: Record<ListKind, (count: number) => string> = {
  card: (count) => m.share_kind_card({ count }),
  printing: (count) => m.share_kind_printing({ count }),
  copy: (count) => m.share_kind_copy({ count }),
};

export function ShareableListsPanel({ slug }: { slug: string }) {
  const { data } = useFriendGroupShareableLists(slug);
  const share = useShareListWithFriendGroup();
  const unshare = useUnshareListFromFriendGroup();

  if (data.items.length === 0) {
    return (
      <SettingsSection
        id="lists"
        className="scroll-mt-28"
        title={m.share_lists_title()}
        description={
          <ParaglideMessage
            message={m.share_lists_empty}
            markup={{
              link: ({ children }) => (
                <TextLink render={<Link to="/collections" />}>{children}</TextLink>
              ),
            }}
          />
        }
      />
    );
  }
  return (
    <SettingsSection
      id="lists"
      className="scroll-mt-28"
      title={m.share_lists_title()}
      description={m.share_lists_description()}
    >
      <RowList>
        {data.items.map((row) => (
          <ShareableListRow
            key={row.listId}
            slug={slug}
            row={row}
            share={share}
            unshare={unshare}
          />
        ))}
      </RowList>
    </SettingsSection>
  );
}

function ShareableListRow({
  slug,
  row,
  share,
  unshare,
}: {
  slug: string;
  row: FriendGroupShareableListResponse;
  share: ReturnType<typeof useShareListWithFriendGroup>;
  unshare: ReturnType<typeof useUnshareListFromFriendGroup>;
}) {
  const isShared = row.sharedAt !== null;
  const IntentIcon = INTENT_ICON[row.listIntent];
  const KindIcon = LIST_KIND_ICON[row.listKind];
  const kindCount = KIND_COUNT[row.listKind](row.entryCount);
  return (
    <RowListItem className="justify-between">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isShared}
          onCheckedChange={(checked) => {
            if (checked) {
              share.mutate({ slug, listId: row.listId });
            } else {
              unshare.mutate({ slug, listId: row.listId });
            }
          }}
          disabled={share.isPending || unshare.isPending}
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{row.listName}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-2xs gap-1">
              <IntentIcon className="size-3" />
              {INTENT_LABEL[row.listIntent]()}
            </Badge>
            <Badge variant="outline" className="text-2xs gap-1">
              <KindIcon className="size-3" />
              {kindCount}
            </Badge>
          </div>
        </div>
      </div>
      {row.listIntent === "organize" ? (
        <Badge variant="outline" className="text-xs">
          {m.share_lists_organize_note()}
        </Badge>
      ) : null}
    </RowListItem>
  );
}
