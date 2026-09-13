import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { FriendGroupMemberResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, Share2Icon, SparklesIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CardLink } from "@/components/ui/card-link";
import { IconChip } from "@/components/ui/icon-chip";
import { TextLink } from "@/components/ui/text-link";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { useFriendGroupShareableLists } from "@/features/groups/hooks/use-friend-group-sharing";
import { distinctPrintingIds } from "@/features/groups/lib/friend-group-activity";
import type { TradeHubCard } from "@/features/groups/lib/trade-hub";
import {
  isQuietTradeHubCard,
  needsYouLine,
  suggestionsLine,
} from "@/features/groups/lib/trade-hub";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ShareListsWithGroupDialog } from "./share-lists-with-group-dialog";

function factsLine(card: TradeHubCard<FriendGroupMemberResponse>): string | null {
  return card.open.length > 0 ? m.trades_waiting_on_them({ count: card.open.length }) : null;
}

function footerLine(card: TradeHubCard<FriendGroupMemberResponse>): string | null {
  const parts: string[] = [];
  if (card.tradedCount > 0) {
    const count = card.tradedCount;
    parts.push(m.trades_done({ count }));
  }
  if (card.elsewhereCount > 0) {
    parts.push(m.trades_in_other_groups({ count: card.elsewhereCount }));
  }
  if (card.listCount > 0) {
    const count = card.listCount;
    parts.push(m.trades_shares_lists({ count }));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TradeHubMemberCard({
  card,
  slug,
}: {
  card: TradeHubCard<FriendGroupMemberResponse>;
  slug: string;
}) {
  const { member } = card;
  const { printingsById } = useCards();
  const quiet = isQuietTradeHubCard(card);
  const action = needsYouLine(card.needsYou);
  const suggestions = suggestionsLine(card);
  const facts = factsLine(card);
  const footer = footerLine(card);
  const waitingArt = distinctPrintingIds(card.needsYou).map((printingId) => ({
    key: printingId,
    imageId: frontImageId(printingsById[printingId]),
  }));

  return (
    <CardLink
      render={
        <Link to="/trades/$userId" params={{ userId: member.userId }} search={{ from: slug }} />
      }
      className={cn("gap-1.5 p-4", quiet && "opacity-60")}
    >
      <div className="flex items-center gap-2.5">
        <UserAvatar
          image={member.userImage}
          name={member.userName}
          gravatarHash={member.gravatarHash}
          size="sm"
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {member.userName ?? m.trades_member_fallback()}
        </span>
        <ChevronRightIcon className="text-muted-foreground/40 group-hover/card:text-muted-foreground size-4 shrink-0 transition-transform group-hover/card:translate-x-0.5" />
      </div>

      {quiet ? <p className="text-muted-foreground">{m.trades_nothing_in_group()}</p> : null}
      {action === null ? null : <p className="text-foreground text-sm font-medium">{action}</p>}
      {waitingArt.length > 0 ? (
        <CardArtThumbStack items={waitingArt} max={5} thumbClassName="w-8" />
      ) : null}
      {suggestions === null ? null : (
        <p className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
          <SparklesIcon className="text-success size-3.5 shrink-0" />
          {suggestions}
        </p>
      )}
      {facts === null ? null : <p className="text-muted-foreground text-sm">{facts}</p>}
      {footer === null ? null : <p className="text-muted-foreground text-xs">{footer}</p>}
    </CardLink>
  );
}

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

  return (
    <Callout className="flex items-center gap-3">
      <IconChip icon={Share2Icon} tone="info" size="sm" shape="round" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">
          {m.trades_share_band_shared({ shared: shared.length, total: tradable.length })}
        </p>
        <p className="text-muted-foreground text-xs">{m.trades_share_band_hint()}</p>
      </div>
      {shared.length === tradable.length ? null : (
        <>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
            <Share2Icon />
            {m.trades_share_more()}
          </Button>
          <ShareListsWithGroupDialog
            slug={slug}
            groupName={groupName}
            open={open}
            onOpenChange={setOpen}
            cancelLabel={m.common_cancel()}
            preselectAll={false}
          />
        </>
      )}
    </Callout>
  );
}
