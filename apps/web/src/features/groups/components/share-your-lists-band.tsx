import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { Share2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconChip } from "@/components/ui/icon-chip";
import { TextLink } from "@/components/ui/text-link";
import { useFriendGroupShareableLists } from "@/features/groups/hooks/use-friend-group-sharing";
import { m } from "@/paraglide/messages.js";

import { ShareListsWithGroupDialog } from "./share-lists-with-group-dialog";

export function ShareYourListsBand({ slug, groupName }: { slug: string; groupName: string }) {
  const { data } = useFriendGroupShareableLists(slug);
  const [open, setOpen] = useState(false);

  const tradable = data.items.filter(
    (item) => item.listIntent === "wish" || item.listIntent === "trade",
  );
  const shared = tradable.filter((item) => item.sharedAt !== null);

  if (tradable.length === 0) {
    return (
      <Callout className="flex items-center gap-3">
        <IconChip icon={Share2Icon} tone="info" size="sm" shape="round" />
        <p className="text-muted-foreground min-w-0 flex-1">
          <ParaglideMessage
            message={m.trades_share_band_empty}
            inputs={{ group: groupName }}
            markup={{
              link: ({ children }) => (
                <TextLink variant="muted" render={<Link to="/collections" />}>
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
      </Callout>
    );
  }

  if (shared.length === tradable.length) {
    return null;
  }

  return (
    <Callout className="flex items-center gap-3">
      <IconChip icon={Share2Icon} tone="info" size="sm" shape="round" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">
          {m.trades_share_band_shared({ shared: shared.length, total: tradable.length })}
        </p>
        <p className="text-muted-foreground text-xs">{m.trades_share_band_hint()}</p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
        <Share2Icon />
        {m.trades_share_more()}
      </Button>
      <ShareListsWithGroupDialog
        slug={slug}
        groupName={groupName}
        open={open}
        onOpenChange={setOpen}
        flow="manage"
      />
    </Callout>
  );
}
