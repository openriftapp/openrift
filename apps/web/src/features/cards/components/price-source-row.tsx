import { ALL_MARKETPLACES, MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";
import { Link } from "@tanstack/react-router";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { SimpleSelect } from "@/components/ui/simple-select";
import { TextLink } from "@/components/ui/text-link";
import { LabelledRow } from "@/features/cards/components/labelled-row";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const MARKETPLACE_ITEMS = ALL_MARKETPLACES.map((marketplace) => ({
  value: marketplace,
  label: MARKETPLACE_META[marketplace].label,
  detail: MARKETPLACE_CURRENCY[marketplace],
}));

export function PriceSourceRow() {
  const userId = useUserId();
  const favorite = useDisplayStore((state) => state.marketplaceOrder[0]);
  const setFavoriteMarketplace = useDisplayStore((state) => state.setFavoriteMarketplace);

  return (
    <LabelledRow label={m.cards_prices_label()}>
      {userId ? (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <MarketplaceIcon marketplace={favorite} />
          {MARKETPLACE_META[favorite].label}
          <TextLink variant="muted" render={<Link to="/profile" hash="marketplaces" />}>
            {m.cards_prices_change()}
          </TextLink>
        </span>
      ) : (
        <SimpleSelect
          size="sm"
          items={MARKETPLACE_ITEMS}
          value={favorite}
          onChange={setFavoriteMarketplace}
          label={m.cards_prices_label()}
          className="min-w-36"
        />
      )}
    </LabelledRow>
  );
}
