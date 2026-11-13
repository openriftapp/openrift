import type { Marketplace } from "@openrift/shared/types/pricing";
import { PackageSearchIcon } from "lucide-react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import type { DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import { formatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface DeckOwnershipPanelProps {
  data: DeckOwnershipData;
  marketplace: Marketplace;
  onViewMissing: () => void;
}

export function DeckOwnershipBody({ data, marketplace, onViewMissing }: DeckOwnershipPanelProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm">
        <Row
          label={m.decks_overview_own_owned()}
          value={`${data.totalOwned} / ${data.totalNeeded}`}
        />
        {data.totalBorrowed > 0 && (
          <Tooltip>
            <TooltipTrigger render={<div />}>
              <Row
                label={m.decks_overview_own_borrowed()}
                value={m.common_cards({ count: data.totalBorrowed })}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-xs">
              {m.decks_overview_borrowed_hint()}
            </TooltipContent>
          </Tooltip>
        )}
        {data.missingCount > 0 && (
          <Row
            label={m.decks_overview_own_missing()}
            value={m.common_cards({ count: data.missingCount })}
          />
        )}
        {data.totalLocked > 0 && (
          <Tooltip>
            <TooltipTrigger render={<div />}>
              <Row
                label={m.decks_overview_own_locked()}
                value={m.common_cards({ count: data.totalLocked })}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-xs">
              {m.decks_overview_own_locked_hint()}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {(data.deckValue !== undefined || data.unpricedCount > 0) && (
        <PriceBlock data={data} marketplace={marketplace} />
      )}

      {data.missingCards.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={onViewMissing}>
          <PackageSearchIcon className="size-3.5" />
          {m.decks_overview_view_missing()}
        </Button>
      )}
    </div>
  );
}

function Row({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", indent && "pl-3 text-xs")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PriceBlock({ data, marketplace }: { data: DeckOwnershipData; marketplace: Marketplace }) {
  const fmt = formatterForMarketplace(marketplace);
  const showMissing =
    (data.missingValue !== undefined && data.missingValue > 0) || data.missingUnpricedCount > 0;
  const withUnpriced = (value: number | undefined, unpriced: number) =>
    unpriced > 0 ? `${fmt(value)} ${m.common_unpriced({ count: unpriced })}` : fmt(value);
  const showSplit = data.sideboardValue !== undefined && data.sideboardValue > 0;
  const showAsShown =
    showMissing &&
    data.missingAsDisplayedValue !== undefined &&
    data.missingValue !== undefined &&
    data.missingAsDisplayedValue > data.missingValue;

  return (
    <div className="space-y-1 text-sm">
      <div className="text-muted-foreground flex items-center gap-1.5 pb-0.5 text-xs">
        <MarketplaceIcon marketplace={marketplace} />
        {m.decks_overview_marketplace_prices({ marketplace: MARKETPLACE_META[marketplace].label })}
      </div>
      <PriceRow
        label={m.decks_overview_deck_value()}
        value={withUnpriced(data.deckValue, data.unpricedCount)}
      />
      {showSplit && (
        <>
          <PriceRow label={m.decks_overview_main_deck()} value={fmt(data.mainValue)} indent />
          <PriceRow label={m.decks_overview_sideboard()} value={fmt(data.sideboardValue)} indent />
        </>
      )}
      {showMissing && (
        <PriceRow
          label={m.decks_import_missing_cost()}
          value={withUnpriced(data.missingValue, data.missingUnpricedCount)}
        />
      )}
      {showAsShown && (
        <PriceRow
          label={m.decks_overview_price_as_shown()}
          value={fmt(data.missingAsDisplayedValue)}
          indent
        />
      )}
    </div>
  );
}

function PriceRow({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", indent && "pl-3 text-xs")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}
