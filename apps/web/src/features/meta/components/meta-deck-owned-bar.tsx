import type { Marketplace } from "@openrift/shared/types/pricing";

import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { compactFormatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function MetaDeckOwnedBar({
  cost,
  marketplace,
  compact = false,
  className,
}: {
  cost?: MetaDeckCost;
  marketplace: Marketplace;
  compact?: boolean;
  className?: string;
}) {
  if (cost === undefined || cost.owned === undefined || cost.needed === 0) {
    return null;
  }
  const complete = cost.owned >= cost.needed;
  const percent = Math.min(100, Math.round((cost.owned / cost.needed) * 100));
  const toComplete = cost.toComplete;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span
        aria-hidden
        className={cn(
          "block h-1 overflow-hidden rounded-full",
          complete ? "bg-border-accent/25" : "bg-muted",
        )}
      >
        <span
          className={cn("block h-full rounded-full", complete ? "bg-border-accent" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span
        className={cn(
          "flex justify-between text-xs tabular-nums",
          compact ? "gap-1.5 whitespace-nowrap" : "flex-wrap gap-x-1.5",
          complete ? "text-border-accent font-medium" : "text-muted-foreground",
        )}
      >
        {complete ? (
          <>
            <span>{m.meta_deck_all_owned({ count: String(cost.needed) })}</span>
            <span>{m.meta_deck_buildable()}</span>
          </>
        ) : (
          <>
            <span>
              {compact
                ? m.meta_deck_owned_ratio({ owned: cost.owned, needed: cost.needed })
                : m.meta_deck_owned_of({ owned: cost.owned, needed: cost.needed })}
            </span>
            {toComplete !== undefined && (toComplete > 0 || cost.unpricedMissing > 0) && (
              <span>
                <span className="text-foreground font-semibold">
                  {compactFormatterForMarketplace(marketplace)(toComplete)}
                </span>{" "}
                {m.meta_deck_to_complete()}
                {cost.unpricedMissing > 0 &&
                  ` ${m.common_unpriced({ count: cost.unpricedMissing })}`}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}
