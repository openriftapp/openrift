import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type { FriendGroupShopSearchResult } from "@openrift/shared/types/api/friend-group";
import { PlusIcon, StoreIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
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
            <RowListItem key={shop.storeId} className="items-start justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{shop.name}</span>
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
                onClick={() => unlink.mutate({ slug, storeId: shop.storeId })}
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
  const [resetKey, setResetKey] = useState(0);
  const link = useLinkFriendGroupShop();
  const search = useFriendGroupShopSearch(slug, term);
  const results = search.data?.items ?? [];

  return (
    <Combobox<FriendGroupShopSearchResult>
      key={resetKey}
      items={results}
      value={null}
      // The server already narrowed the list, and it matches on the address
      // too, which the label doesn't carry.
      filter={null}
      onValueChange={(shop) => {
        if (shop === null || shop.linked) {
          return;
        }
        link.mutate({ slug, storeId: shop.storeId });
        setTerm("");
        setResetKey((key) => key + 1);
      }}
      onInputValueChange={setTerm}
      itemToStringLabel={(shop) => shop.name}
    >
      <ComboboxTrigger
        render={<Button variant="outline" size="sm" disabled={disabled || link.isPending} />}
      >
        <PlusIcon className="size-4" />
        {m.groups_shops_add()}
      </ComboboxTrigger>
      <ComboboxContent className="w-96 max-w-[90vw]">
        <ComboboxInput placeholder={m.groups_shops_search_placeholder()} showTrigger={false} />
        <ComboboxEmpty>
          {term.trim().length < SHOP_SEARCH_MIN_LENGTH
            ? m.groups_shops_search_prompt()
            : search.isPending
              ? m.groups_shops_searching()
              : m.groups_shops_search_empty()}
        </ComboboxEmpty>
        <ComboboxList>
          {(shop: FriendGroupShopSearchResult) => (
            <ComboboxItem key={shop.storeId} value={shop} disabled={shop.linked}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{shop.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {[shop.location, m.groups_shops_upcoming_count({ count: shop.upcomingCount })]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {shop.linked ? (
                <span className="text-muted-foreground text-xs">{m.groups_shops_linked()}</span>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
