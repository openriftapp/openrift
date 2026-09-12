import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";
import { CARDMARKET_OVERLAY_MAX_LISTS } from "@openrift/shared/contracts/cardmarket-overlay";
import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { Link } from "@tanstack/react-router";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CountPill } from "@/components/ui/count-pill";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
import { useCardmarketOverlaySnapshot } from "@/features/extension/hooks/use-cardmarket-overlay";
import { useOverlayCaptured } from "@/features/extension/hooks/use-overlay-captured";
import { summarizeListNames } from "@/features/extension/lib/overlay-list-names";
import { serializeOverlaySnapshot } from "@/features/extension/lib/overlay-snapshot-script";
import { useLists } from "@/features/lists/hooks/use-lists";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function ownedOrWantedCount(snapshot: CardmarketOverlaySnapshot): number {
  const cards = snapshot.products.filter((row) => row.owned > 0 || row.wanted > 0);
  return new Set(cards.map((row) => row.idProduct)).size;
}

function HandOff({ snapshot }: { snapshot: CardmarketOverlaySnapshot }) {
  const captured = useOverlayCaptured(snapshot.generatedAt);
  const cards = ownedOrWantedCount(snapshot);

  return (
    <SettingsSection
      title={
        <>
          {m.extension_overlay_ready_for()}{" "}
          <span className="font-medium">
            {summarizeListNames(snapshot.lists.map((list) => list.name))}
          </span>
        </>
      }
      description={m.extension_overlay_ready_description({
        cards:
          cards === 1
            ? m.extension_overlay_ready_cards_one({ count: cards })
            : m.extension_overlay_ready_cards_other({ count: cards }),
        marketplace: marketplaceLabel(snapshot.marketplace),
        time: formatDayTimeLocal(snapshot.generatedAt),
      })}
    >
      {captured ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <CheckIcon className="text-success size-4 shrink-0" />
          {m.extension_overlay_saved()}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 shrink-0 animate-spin" />
            {m.extension_overlay_waiting()}
          </p>
          <p className="text-muted-foreground text-sm">
            {m.extension_overlay_waiting_hint_before()}{" "}
            <TextLink render={<Link to="/help/$slug" params={{ slug: "browser-extension" }} />}>
              {m.extension_overlay_waiting_hint_link()}
            </TextLink>
            {m.extension_overlay_waiting_hint_after()}
          </p>
        </div>
      )}

      <script
        type="application/json"
        data-openrift-overlay-snapshot=""
        dangerouslySetInnerHTML={{ __html: serializeOverlaySnapshot(snapshot) }}
      />
    </SettingsSection>
  );
}

export function CardmarketOverlayPage() {
  const { data: wishlists } = useLists("wish");
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  // Excluded rather than picked, so a wishlist made elsewhere arrives ticked.
  const pickedIds = wishlists.filter((list) => !excludedIds.has(list.id)).map((list) => list.id);
  const tooMany = pickedIds.length > CARDMARKET_OVERLAY_MAX_LISTS;
  const snapshot = useCardmarketOverlaySnapshot(tooMany ? [] : pickedIds);

  const togglePicked = (listId: string, picked: boolean) => {
    const next = new Set(excludedIds);
    if (picked) {
      next.delete(listId);
    } else {
      next.add(listId);
    }
    setExcludedIds(next);
  };

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.extension_overlay_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        <PageDescription>{m.extension_overlay_description()}</PageDescription>

        <SettingsSection title={m.extension_overlay_wishlists()}>
          {wishlists.length === 0 ? (
            <p className="text-muted-foreground text-sm">{m.extension_overlay_no_wishlists()}</p>
          ) : (
            <RowList>
              {wishlists.map((list) => (
                <RowListItem key={list.id}>
                  <Checkbox
                    id={`overlay-wishlist-${list.id}`}
                    checked={!excludedIds.has(list.id)}
                    onCheckedChange={(checked) => togglePicked(list.id, checked === true)}
                  />
                  <label
                    htmlFor={`overlay-wishlist-${list.id}`}
                    className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                  >
                    {list.name}
                  </label>
                  <CountPill>{list.entryCount}</CountPill>
                </RowListItem>
              ))}
            </RowList>
          )}
        </SettingsSection>

        {tooMany ? (
          <p className="text-sm">
            {m.extension_overlay_too_many({ count: CARDMARKET_OVERLAY_MAX_LISTS })}
          </p>
        ) : null}

        {!tooMany && wishlists.length > 0 && pickedIds.length === 0 ? (
          <p className="text-sm">{m.extension_overlay_tick_one()}</p>
        ) : null}

        {snapshot.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">{m.extension_overlay_load_error()}</p>
            <Button variant="outline" size="sm" onClick={() => void snapshot.refetch()}>
              {m.extension_overlay_try_again()}
            </Button>
          </div>
        ) : null}

        {snapshot.isPending && pickedIds.length > 0 && !tooMany ? (
          <p className="text-muted-foreground text-sm">{m.extension_overlay_working()}</p>
        ) : null}

        {snapshot.data ? <HandOff snapshot={snapshot.data} /> : null}
      </div>
    </>
  );
}
