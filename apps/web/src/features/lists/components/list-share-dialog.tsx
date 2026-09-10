import type {
  ListEntryDetailResponse,
  ListIntent,
  ListKind,
} from "@openrift/shared/types/api/list";
import type { Currency, TradePreference } from "@openrift/shared/types/api/trade-preferences";
import { useQueryClient } from "@tanstack/react-query";
import { CatchBoundary, Link } from "@tanstack/react-router";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { ensurePriceLookup } from "@/features/cards/hooks/use-prices";
import { ShareDialog } from "@/features/groups/components/share-dialog";
import { ListGroupShareSection } from "@/features/lists/components/list-group-share-section";
import { useShareList, useUnshareList } from "@/features/lists/hooks/use-lists";
import { formatListShareText } from "@/features/lists/lib/list-export";
import { useEnumOrders } from "@/hooks/use-enums";
import { listOwnerImageUrl, shareImageOptions, shareImageVersion } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";

const BINDER_SUBTITLES: Record<ListIntent, string> = {
  wish: "Scan to see my wishlist",
  trade: "Scan to see my trades",
  organize: "Scan to see this list",
};

interface ListShareDialogProps {
  listId: string;
  listName: string;
  kind: ListKind;
  intent: ListIntent;
  tradeDefaults: TradePreference;
  currency: Currency | null;
  isPublic: boolean;
  shareToken: string | null;
  updatedAt: string;
  entries: readonly ListEntryDetailResponse[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListShareDialog({
  listId,
  listName,
  kind,
  intent,
  tradeDefaults,
  currency,
  isPublic,
  shareToken,
  updatedAt,
  entries,
  open,
  onOpenChange,
}: ListShareDialogProps) {
  const shareList = useShareList();
  const unshareList = useUnshareList();
  const queryClient = useQueryClient();
  const { labels } = useEnumOrders();

  const shareUrl = shareLinkUrl("list", { shareToken, isPublic });

  const buildShareText = async (): Promise<string> => {
    // Only CardTrader-priced lists need the (lazily fetched) price payload;
    // fixed prices resolve from the entry/list data, others show no price.
    const usesCardTrader =
      tradeDefaults.pricePref === "ct_zero" ||
      entries.some((entry) => entry.tradeOverride.pricePref === "ct_zero");
    let ctPriceFor: ((printingId: string) => number | undefined) | undefined;
    if (usesCardTrader) {
      try {
        const lookup = await ensurePriceLookup(queryClient);
        ctPriceFor = (printingId) => lookup.get(printingId, "cardtrader");
      } catch {
        // Prices unavailable — fall back to no CardTrader prices.
      }
    }
    return formatListShareText(listName, kind, entries, shareUrl, labels.finishes, {
      tradeDefaults,
      currency,
      ctPriceFor,
    });
  };

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share list"
      noun="list"
      link={{
        url: shareUrl,
        label: "List share link",
        exposes: "view the cards on this list",
        unfurls: true,
        onCreate: () => shareList.mutate(listId),
        creating: shareList.isPending,
        onStop: () => unshareList.mutate(listId),
        stopping: unshareList.isPending,
      }}
      linkNote={
        intent === "organize" ? null : (
          <p className="text-muted-foreground text-sm">
            One link covers every wishlist and tradelist you have, under{" "}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => onOpenChange(false)}
              render={<Link to="/profile" hash="sharing" />}
            >
              Public sharing
            </Button>
            .
          </p>
        )
      }
      access={
        <CatchBoundary getResetKey={() => listId} errorComponent={() => null}>
          <Suspense fallback={null}>
            <ListGroupShareSection listId={listId} intent={intent} />
          </Suspense>
        </CatchBoundary>
      }
      text={{
        cacheKey: [listId, updatedAt, entries.length, shareUrl],
        getText: buildShareText,
        description:
          shareUrl === null
            ? "Drop the list into WhatsApp, Discord, or any group chat. The text carries no link until you create one above."
            : "Drop the list into WhatsApp, Discord, or any group chat.",
      }}
      image={{
        title: listName,
        filenameBase: listName || "list",
        // Owner-authenticated route, so the render works whether or not the
        // list is shared (the public/og image needs a share token).
        buildUrl: (choice) =>
          listOwnerImageUrl(
            getSiteUrl(),
            listId,
            shareImageVersion(updatedAt),
            shareImageOptions(choice),
          ),
        scales: [1, 2],
        qrNoun: "list",
        qrAvailable: shareUrl !== null,
      }}
      qrFilenameBase={listName || "list"}
      print={{
        defaultTitle: listName,
        defaultSubtitle: BINDER_SUBTITLES[intent],
        filenameHint: listName,
      }}
    />
  );
}
