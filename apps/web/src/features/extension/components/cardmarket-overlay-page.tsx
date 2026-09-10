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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CountPill } from "@/components/ui/count-pill";
import { useCardmarketOverlaySnapshot } from "@/features/extension/hooks/use-cardmarket-overlay";
import { useOverlayCaptured } from "@/features/extension/hooks/use-overlay-captured";
import { summarizeListNames } from "@/features/extension/lib/overlay-list-names";
import { serializeOverlaySnapshot } from "@/features/extension/lib/overlay-snapshot-script";
import { useLists } from "@/features/lists/hooks/use-lists";
import { cn, PAGE_WIDTH } from "@/lib/utils";

function ownedOrWantedCount(snapshot: CardmarketOverlaySnapshot): number {
  const cards = snapshot.products.filter((row) => row.owned > 0 || row.wanted > 0);
  return new Set(cards.map((row) => row.idProduct)).size;
}

function HandOff({ snapshot }: { snapshot: CardmarketOverlaySnapshot }) {
  const captured = useOverlayCaptured(snapshot.generatedAt);
  const cards = ownedOrWantedCount(snapshot);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p>
            Ready for{" "}
            <span className="font-medium">
              {summarizeListNames(snapshot.lists.map((list) => list.name))}
            </span>
            .
          </p>
          <p className="text-muted-foreground text-sm">
            {cards} {cards === 1 ? "card" : "cards"} you own or want, with your{" "}
            {marketplaceLabel(snapshot.marketplace)} prices. Prepared{" "}
            {formatDayTimeLocal(snapshot.generatedAt)}.
          </p>
        </div>

        {captured ? (
          <p className="text-success flex items-center gap-2 text-sm font-medium">
            <CheckIcon className="size-4 shrink-0" />
            Saved to your extension
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 shrink-0 animate-spin" />
              Waiting for the OpenRift extension…
            </p>
            <p className="text-muted-foreground text-sm">
              It takes them by itself once allowed. Nothing yet? Click the OpenRift icon while this
              page is open, or read{" "}
              <Link
                to="/help/$slug"
                params={{ slug: "browser-extension" }}
                className="text-primary hover:underline"
              >
                how to set the extension up
              </Link>
              .
            </p>
          </div>
        )}

        <script
          type="application/json"
          data-openrift-overlay-snapshot=""
          dangerouslySetInnerHTML={{ __html: serializeOverlaySnapshot(snapshot) }}
        />
      </CardContent>
    </Card>
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
          <PageTopBarTitle>Wishlist counts on Cardmarket</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "space-y-4 px-4 pt-3 pb-12")}>
        <PageDescription>
          The OpenRift extension marks every card on a Cardmarket seller&apos;s offers with how many
          copies you own and how many you still want. Pick the wishlists it counts.
        </PageDescription>

        <Card>
          <CardContent className="flex flex-col gap-3">
            {wishlists.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                You have no wishlists yet. Create one from your collection and it shows up here.
              </p>
            ) : (
              wishlists.map((list) => (
                <div key={list.id} className="flex items-center gap-3">
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
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {tooMany ? (
          <p className="text-sm">
            That is more than {CARDMARKET_OVERLAY_MAX_LISTS} wishlists at once. Untick a few.
          </p>
        ) : null}

        {!tooMany && wishlists.length > 0 && pickedIds.length === 0 ? (
          <p className="text-sm">Tick at least one wishlist.</p>
        ) : null}

        {snapshot.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Your counts could not be loaded.</p>
            <Button variant="outline" size="sm" onClick={() => void snapshot.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}

        {snapshot.isPending && pickedIds.length > 0 && !tooMany ? (
          <p className="text-muted-foreground text-sm">Working out your counts…</p>
        ) : null}

        {snapshot.data ? <HandOff snapshot={snapshot.data} /> : null}
      </div>
    </>
  );
}
