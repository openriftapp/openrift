import type { CardTradeResponse, CardTradeStatus } from "@openrift/shared/types/api/card-trade";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { tradeStatusLabel } from "@/features/groups/lib/trade-derivation";
import { agreedSeenState } from "@/features/groups/lib/trade-seen";
import { memberName } from "@/lib/member-name";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TradeDirectionIcon({ incoming }: { incoming: boolean }) {
  const Icon = incoming ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        incoming ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
      title={incoming ? m.trades_comes_to_you() : m.trades_goes_to_them()}
      aria-label={incoming ? m.trades_comes_to_you() : m.trades_goes_to_them()}
    >
      <Icon className="size-4" />
    </span>
  );
}

export type TradeBadgeState =
  | "your-move"
  | "waiting-for-them"
  | "ready-to-swap"
  | "done-your-side"
  | `status:${CardTradeStatus}`;

export function tradeBadgeState({
  status,
  awaitingViewer,
  viewerSettled,
}: {
  status: CardTradeStatus;
  awaitingViewer?: boolean;
  viewerSettled?: boolean;
}): TradeBadgeState {
  if (status === "pending") {
    return awaitingViewer === true ? "your-move" : "waiting-for-them";
  }
  if (status === "reserved") {
    return viewerSettled === true ? "done-your-side" : "ready-to-swap";
  }
  return `status:${status}`;
}

export function AgreedSeenBadge({
  trade,
  className,
}: {
  trade: CardTradeResponse;
  className?: string;
}) {
  const state = agreedSeenState(trade);
  if (state === null) {
    return null;
  }
  if (state === "new") {
    return (
      <Badge variant="warning" className={cn("shrink-0", className)}>
        <SparklesIcon />
        {m.trades_badge_new_agreed()}
      </Badge>
    );
  }
  const name = memberName(trade.counterparty.name);
  return (
    <Badge variant="secondary" className={cn("shrink-0", className)}>
      {state === "seen-by-them" ? <EyeIcon /> : <EyeOffIcon />}
      <span className="truncate">
        {state === "seen-by-them"
          ? m.trades_badge_seen_by({ name })
          : m.trades_badge_not_seen_by({ name })}
      </span>
    </Badge>
  );
}

export function TradeStatusBadge({
  status,
  counterpartyName,
  awaitingViewer,
  viewerSettled,
  className,
}: {
  status: CardTradeStatus;
  counterpartyName?: string | null;
  awaitingViewer?: boolean;
  viewerSettled?: boolean;
  // Pass `min-w-0 shrink` where the row must never widen its container:
  // "Waiting for {name}" can be as long as the member's name.
  className?: string;
}) {
  const state = tradeBadgeState({ status, awaitingViewer, viewerSettled });
  if (state === "your-move") {
    return (
      <Badge variant="warning" className={cn("shrink-0", className)}>
        <BellIcon />
        {m.trades_badge_your_move()}
      </Badge>
    );
  }
  if (state === "waiting-for-them") {
    return (
      <Badge variant="secondary" className={cn("shrink-0", className)}>
        <ClockIcon />
        <span className="truncate">
          {m.trades_badge_waiting_for({ name: counterpartyName ?? m.trades_them() })}
        </span>
      </Badge>
    );
  }
  if (state === "done-your-side") {
    return (
      <Badge
        variant="secondary"
        className={cn("shrink-0", className)}
        title={m.trades_badge_done_your_side_title()}
      >
        <CheckIcon />
        <span className="truncate">{m.trades_badge_done_your_side()}</span>
      </Badge>
    );
  }
  if (state === "ready-to-swap") {
    return (
      <Badge variant="success" className={cn("shrink-0", className)}>
        <CheckIcon />
        {m.trades_badge_ready_to_swap()}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("shrink-0", className)}>
      {tradeStatusLabel(status)}
    </Badge>
  );
}
