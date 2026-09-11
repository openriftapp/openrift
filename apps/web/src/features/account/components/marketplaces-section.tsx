import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES, MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDisplayStore } from "@/stores/display-store";

import { ResetButton } from "./reset-button";

function nonEmptyOrder(order: Marketplace[]): [Marketplace, ...Marketplace[]] | null {
  const [first, ...rest] = order;
  return first === undefined ? null : [first, ...rest];
}

export function MarketplacesSection() {
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const setMarketplaceOrder = useDisplayStore((s) => s.setMarketplaceOrder);
  const overrides = useDisplayStore((s) => s.overrides);
  const resetPreference = useDisplayStore((s) => s.resetPreference);

  const enabledSet = new Set(marketplaceOrder);

  function toggleMarketplace(marketplace: Marketplace) {
    if (!enabledSet.has(marketplace)) {
      setMarketplaceOrder([...marketplaceOrder, marketplace]);
      return;
    }
    const next = nonEmptyOrder(marketplaceOrder.filter((m) => m !== marketplace));
    if (next !== null) {
      setMarketplaceOrder(next);
    }
  }

  function moveMarketplace(marketplace: Marketplace, direction: -1 | 1) {
    const index = marketplaceOrder.indexOf(marketplace);
    if (index === -1) {
      return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= marketplaceOrder.length) {
      return;
    }
    const reordered = [...marketplaceOrder];
    reordered.splice(index, 1);
    reordered.splice(newIndex, 0, marketplace);
    const next = nonEmptyOrder(reordered);
    if (next !== null) {
      setMarketplaceOrder(next);
    }
  }

  return (
    <SettingsSection
      id="marketplaces"
      title="Marketplaces"
      description="The first one is shown in the card grid. CardTrader is recommended: it prices by language and condition."
      action={
        overrides.marketplaceOrder !== null && (
          <ResetButton
            onClick={() => resetPreference("marketplaceOrder")}
            label="Reset marketplace order"
          />
        )
      }
    >
      <div className="flex flex-col gap-1">
        {[...marketplaceOrder, ...ALL_MARKETPLACES.filter((m) => !enabledSet.has(m))].map(
          (marketplace) => {
            const enabled = enabledSet.has(marketplace);
            const index = marketplaceOrder.indexOf(marketplace);
            const label = MARKETPLACE_LINKS[marketplace].label;
            return (
              <div key={marketplace} className="flex min-h-8 items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`pref-mp-${marketplace}`}
                    checked={enabled}
                    disabled={enabled && marketplaceOrder.length === 1}
                    onCheckedChange={() => toggleMarketplace(marketplace)}
                  />
                  <Label htmlFor={`pref-mp-${marketplace}`} className="font-normal">
                    {label}
                  </Label>
                  <span className="text-muted-foreground text-xs">
                    {MARKETPLACE_CURRENCY[marketplace]}
                  </span>
                  {enabled && index === 0 && <Badge variant="subtle">Favorite</Badge>}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!enabled || index === 0}
                    onClick={() => moveMarketplace(marketplace, -1)}
                    aria-label={`Move ${label} up`}
                  >
                    <ArrowUpIcon className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!enabled || index === marketplaceOrder.length - 1}
                    onClick={() => moveMarketplace(marketplace, 1)}
                    aria-label={`Move ${label} down`}
                  >
                    <ArrowDownIcon className="size-3" />
                  </Button>
                </div>
              </div>
            );
          },
        )}
      </div>
    </SettingsSection>
  );
}
