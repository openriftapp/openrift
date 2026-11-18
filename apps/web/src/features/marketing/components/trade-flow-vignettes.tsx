import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { CheckIcon, ZapIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PROSE_MARKUP } from "@/components/message-markup";
import { MiniCardArt } from "@/components/mini-card-art";
import { ActionBand } from "@/components/ui/action-band";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { TradeShelfRowView } from "@/features/groups/components/trade-shelf-row";
import {
  TradeDirectionIcon,
  TradeStatusBadge,
} from "@/features/groups/components/trade-status-badge";
import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import { FIXTURE_GROUPS, FIXTURE_PEOPLE } from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { Vignette, VignetteHeading } from "./vignette-parts";

const THEM = FIXTURE_PEOPLE.mira.userName;

const SENTENCE_MARKUP = { strong: PROSE_MARKUP.strong, strong2: PROSE_MARKUP.strong };

/** The landing summary is edge-cached for up to a day and can predate the identity fields. */
function tradedName(card: LandingThumbnailCard | undefined): string {
  return card?.name || m.marketing_trade_flow_fallback_card();
}

function MiniPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card ring-border flex flex-col gap-2 rounded-lg p-3 ring-1", className)}>
      {children}
    </div>
  );
}

function shelfItems(urls: string[]) {
  return urls.map((url) => ({ key: url, src: url }));
}

export function TradeMatchVignette({ thumbnailUrls }: { thumbnailUrls: string[] }) {
  return (
    <Vignette>
      <VignetteHeading>{FIXTURE_GROUPS.storeCrew}</VignetteHeading>
      <ActionBand
        icon={ZapIcon}
        tone="gold"
        accent
        label={m.trades_title()}
        value={m.marketing_trade_flow_waiting()}
        valueClassName="font-sans truncate text-base font-medium"
      >
        <ul className="flex flex-col gap-2.5">
          <TradeShelfRowView
            label={m.marketing_trade_flow_you_could_get()}
            tone="success"
            items={shelfItems(thumbnailUrls.slice(0, 4))}
            detail={m.marketing_trade_flow_get_detail()}
          />
          <TradeShelfRowView
            label={m.marketing_trade_flow_theyd_want()}
            tone="success"
            items={shelfItems(thumbnailUrls.slice(4, 6))}
            detail={m.marketing_trade_flow_want_detail()}
          />
        </ul>
      </ActionBand>
    </Vignette>
  );
}

export function TradeRequestVignette({ card }: { card?: LandingThumbnailCard }) {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_trade_flow_suggestions_with({ name: THEM })}</VignetteHeading>
      <MiniPanel>
        <div className="flex min-w-0 items-center gap-2.5">
          <TradeDirectionIcon incoming />
          <MiniCardArt url={card?.url} className="w-9 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{tradedName(card)}</span>
            <span className="text-muted-foreground truncate text-xs">
              {m.marketing_trade_flow_matched()}
            </span>
          </span>
          <UserAvatar name={THEM} size="sm" />
          <span aria-hidden="true" className={buttonVariants({ size: "xs" })}>
            {m.lists_share_request()}
          </span>
        </div>
      </MiniPanel>
      <p className="text-muted-foreground text-xs">{m.marketing_trade_flow_requests_expire()}</p>
    </Vignette>
  );
}

export function TradeReservedVignette({ card }: { card?: LandingThumbnailCard }) {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_trade_flow_your_trades_with({ name: THEM })}</VignetteHeading>
      <MiniPanel>
        <div className="flex min-w-0 items-center gap-2.5">
          <TradeDirectionIcon incoming />
          <MiniCardArt url={card?.url} className="w-9 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{tradedName(card)}</span>
            <span className="text-muted-foreground truncate text-xs">
              {m.marketing_trade_flow_coming_from({ name: THEM })}
            </span>
          </span>
          <TradeStatusBadge status="reserved" />
        </div>
      </MiniPanel>
      <p className="text-muted-foreground text-xs">{m.marketing_trade_flow_reserved_note()}</p>
    </Vignette>
  );
}

export function TradeSettleVignette() {
  const you = m.groups_members_badge_you();
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_trade_flow_settling_up()}</VignetteHeading>
      <MiniPanel>
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={THEM} size="sm" />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            <ParaglideMessage
              message={m.marketing_trade_flow_handed_over}
              inputs={{ name: THEM }}
              markup={SENTENCE_MARKUP}
            />
          </span>
          <Badge variant="success">
            <CheckIcon />
            {m.common_done()}
          </Badge>
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={you} size="sm" />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            <ParaglideMessage
              message={m.marketing_trade_flow_receive_into}
              inputs={{ you, collection: m.marketing_collections_main_binder() }}
              markup={SENTENCE_MARKUP}
            />
          </span>
          <span aria-hidden="true" className={buttonVariants({ variant: "outline", size: "xs" })}>
            {m.trades_settle_button({ count: 1 })}
          </span>
        </div>
      </MiniPanel>
      <p className="text-muted-foreground text-xs">{m.marketing_trade_flow_confirm_note()}</p>
    </Vignette>
  );
}

export function TradeArrivedVignette({ card }: { card?: LandingThumbnailCard }) {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_collections_main_binder()}</VignetteHeading>
      <div className="flex items-center gap-4">
        <MiniCardArt url={card?.url} className="w-24 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate font-medium">{tradedName(card)}</span>
          {/* No "traded from Mira" badge: a copy carries no provenance today,
              and the tour must not advertise a field that does not exist. */}
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="success">{m.marketing_trade_flow_owned_badge()}</Badge>
            <Badge variant="secondary">{m.marketing_trade_flow_condition()}</Badge>
          </span>
          <span className="text-muted-foreground text-xs">
            {m.marketing_trade_flow_off_wishlist({ name: THEM })}
          </span>
        </div>
      </div>
    </Vignette>
  );
}
