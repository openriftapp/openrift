import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES, MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";

import { SettingsSection } from "@/components/layout/settings-section";
import { OrderedToggleList } from "@/features/account/components/ordered-toggle-list";
import { m } from "@/paraglide/messages.js";
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

  return (
    <SettingsSection
      id="marketplaces"
      title={m.profile_marketplaces_title()}
      description={m.profile_marketplaces_description()}
      action={
        overrides.marketplaceOrder !== null && (
          <ResetButton
            onClick={() => resetPreference("marketplaceOrder")}
            label={m.profile_marketplaces_reset()}
          />
        )
      }
    >
      <OrderedToggleList
        idPrefix="pref-mp"
        order={marketplaceOrder}
        options={ALL_MARKETPLACES.map((marketplace) => ({
          value: marketplace,
          label: MARKETPLACE_LINKS[marketplace].label,
          meta: MARKETPLACE_CURRENCY[marketplace],
        }))}
        onChange={(order) => {
          const next = nonEmptyOrder(order);
          if (next !== null) {
            setMarketplaceOrder(next);
          }
        }}
        keepOne
        firstBadge={m.profile_marketplaces_favorite()}
        moveUpLabel={(name) => m.profile_marketplaces_move_up({ name })}
        moveDownLabel={(name) => m.profile_marketplaces_move_down({ name })}
      />
    </SettingsSection>
  );
}
