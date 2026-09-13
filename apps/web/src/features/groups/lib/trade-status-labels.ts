import type {
  CardTradeLiveAnnotation,
  CardTradeLivePhase,
  CardTradeRole,
} from "@openrift/shared/types/api/card-trade";
import type { LucideIcon } from "lucide-react";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

type LiveTradeTone = "soft" | "committed";

export type LiveTradeDirection = "incoming" | "outgoing";

export interface LiveTradeStatusDescriptor {
  label: string;
  direction: LiveTradeDirection;
  icon: LucideIcon;
  tone: LiveTradeTone;
}

export type LiveTradeStatusInput = Pick<CardTradeLiveAnnotation, "role" | "phase">;

function phaseLabel(phase: CardTradeLivePhase): string {
  switch (phase) {
    case "asked": {
      return m.trades_status_requested();
    }
    case "offered": {
      return m.trades_status_offered();
    }
    case "reserved": {
      return m.trades_status_reserved();
    }
  }
}

// Mirrors TradeDirectionIcon in components/friend-groups/trade-row-parts.tsx;
// keep the arrows in sync.
const ROLE_ICONS: Record<CardTradeRole, LucideIcon> = {
  giver: ArrowUpRightIcon,
  receiver: ArrowDownLeftIcon,
};

export function liveTradeStatus(annotation: LiveTradeStatusInput): LiveTradeStatusDescriptor {
  return {
    label: phaseLabel(annotation.phase),
    direction: annotation.role === "giver" ? "outgoing" : "incoming",
    icon: ROLE_ICONS[annotation.role],
    tone: annotation.phase === "asked" ? "soft" : "committed",
  };
}

export const SHARED_RESERVED_STATUS: LiveTradeStatusInput = { role: "giver", phase: "reserved" };

// direction is spelled out here because the arrow carrying it is
// aria-hidden; otherwise a screen reader can't tell arriving from departing.
export function tradeStatusTitle({
  label,
  direction,
  count,
  totalCount,
}: {
  label: string;
  direction?: LiveTradeDirection;
  count?: number;
  totalCount?: number;
}): string {
  const status = direction
    ? m.trades_status_with_direction({
        label,
        direction:
          direction === "incoming"
            ? m.trades_status_direction_incoming()
            : m.trades_status_direction_outgoing(),
      })
    : label;
  if (count === undefined) {
    return status;
  }
  if (totalCount !== undefined && totalCount !== count) {
    return m.trades_status_count_printing({ status, count, total: totalCount });
  }
  return m.trades_status_count_copies({ status, count });
}
