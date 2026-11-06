import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { GROUP_SHOP_SOURCE_LABELS } from "@openrift/shared/group-shops";
import type { FriendGroupShopSearchResult } from "@openrift/shared/types/api/friend-group";
import { PlusIcon, StoreIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  SHOP_SEARCH_MIN_LENGTH,
  useFriendGroupShops,
  useFriendGroupShopSearch,
  useLinkFriendGroupShop,
  useUnlinkFriendGroupShop,
} from "@/features/groups/hooks/use-friend-group-shops";
import { m } from "@/paraglide/messages.js";

export function ShopsPanel({ slug }: { slug: string }) {
  const { data } = useFriendGroupShops(slug);
  const unlink = useUnlinkFriendGroupShop();
  const atLimit = data.items.length >= data.limit;

  return (
    <SettingsSection
      id="shops"
      className="scroll-mt-28"
      title={
        <span className="flex items-center gap-2">
          <StoreIcon className="size-4" />
          {m.groups_shops_panel_title()}
        </span>
      }
      description={m.groups_shops_panel_description()}
    >
      {data.items.length > 0 ? (
        <RowList>
          {data.items.map((shop) => (
            <RowListItem key={shop.shopKey} className="items-start justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {shop.name}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    {GROUP_SHOP_SOURCE_LABELS[shop.source]}
                  </span>
                </span>
                {shop.location ? (
                  <span className="text-muted-foreground text-sm">{shop.location}</span>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {shop.nextEventAt === null
                    ? m.groups_shops_nothing_next_weeks()
                    : m.groups_shops_next_event({
                        when: formatDayTimeLocal(shop.nextEventAt),
                        count: shop.upcomingCount,
                      })}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => unlink.mutate({ slug, shopKey: shop.shopKey })}
                disabled={unlink.isPending}
              >
                <Trash2Icon className="size-4" />
                {m.groups_members_remove()}
              </Button>
            </RowListItem>
          ))}
        </RowList>
      ) : (
        <p className="text-muted-foreground text-sm">{m.groups_shops_none_linked()}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AddShopPicker slug={slug} disabled={atLimit} />
        <span className="text-muted-foreground text-xs">
          {m.groups_shops_linked_count({ count: data.items.length, limit: data.limit })}
        </span>
      </div>
    </SettingsSection>
  );
}

function AddShopPicker({ slug, disabled }: { slug: string; disabled: boolean }) {
  const [term, setTerm] = useState("");
  const link = useLinkFriendGroupShop();
  const search = useFriendGroupShopSearch(slug, term);
  const results = search.data?.items ?? [];
  const byKey = new Map(results.map((shop) => [shop.shopKey, shop]));
  const tooShort = term.trim().length < SHOP_SEARCH_MIN_LENGTH;

  return (
    <ComboboxPicker
      size="sm"
      className="w-auto"
      triggerRender={<Button variant="outline" size="sm" />}
      triggerIcon={<PlusIcon className="size-4" />}
      triggerLabel={m.groups_shops_add()}
      contentClassName="w-96 max-w-[90vw]"
      aria-label={m.groups_shops_add()}
      searchPlaceholder={m.groups_shops_search_placeholder()}
      disabled={disabled || link.isPending}
      options={results.map((shop) => ({
        value: shop.shopKey,
        label: shop.name,
        disabled: shop.linked,
      }))}
      renderOption={(option) => {
        const shop = byKey.get(option.value);
        return shop ? <ShopOption shop={shop} /> : option.label;
      }}
      filter="none"
      query={term}
      onQueryChange={setTerm}
      hint={tooShort ? m.groups_shops_search_prompt() : undefined}
      loading={!tooShort && search.isPending}
      loadingText={m.groups_shops_searching()}
      emptyText={m.groups_shops_search_empty()}
      value={null}
      onChange={(shopKey) => {
        const shop = shopKey === null ? undefined : byKey.get(shopKey);
        if (shop && !shop.linked) {
          link.mutate({ slug, shopKey: shop.shopKey });
        }
      }}
      clearOnSelect
    />
  );
}

function ShopOption({ shop }: { shop: FriendGroupShopSearchResult }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{shop.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {[
            GROUP_SHOP_SOURCE_LABELS[shop.source],
            shop.location,
            m.groups_shops_upcoming_count({ count: shop.upcomingCount }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {shop.linked ? (
        <span className="text-muted-foreground text-xs">{m.groups_shops_linked()}</span>
      ) : null}
    </>
  );
}
