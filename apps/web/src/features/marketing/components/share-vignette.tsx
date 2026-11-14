import { enumLabel } from "@openrift/shared/enum-label";
import { SHARE_IMAGE_COLORS as OG } from "@openrift/shared/share-image-palette";
import {
  deckMetaLabel,
  deckShareDescription,
  deckShareTitle,
  shareByline,
} from "@openrift/shared/share-titles";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { QrCode } from "@/components/ui/qr-code";
import { tabsListVariants } from "@/components/ui/tabs";
import { FIXTURE_LABELS, FIXTURE_SHARED_DECK } from "@/features/marketing/lib/vignette-fixtures";
import { getSiteHost, getSiteUrl } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, Vignette } from "./vignette-parts";

const DECK = FIXTURE_SHARED_DECK;
const FORMAT_LABEL = enumLabel(FIXTURE_LABELS.formats, DECK.formatSlug);

function OutputTabs() {
  const tabs = [
    { label: m.share_output_text(), active: false },
    { label: m.share_output_image(), active: false },
    { label: m.share_output_qr(), active: true },
  ];
  return (
    <span className={cn(tabsListVariants(), "h-(--control-h)")}>
      {tabs.map((tab) => (
        <span
          key={tab.label}
          className={cn(
            "inline-flex h-full items-center justify-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap",
            tab.active
              ? "bg-background text-foreground dark:border-input dark:bg-input/30 shadow-sm"
              : "text-foreground/60 dark:text-muted-foreground",
          )}
        >
          {tab.label}
        </span>
      ))}
    </span>
  );
}

function OgTile({ quantity }: { quantity?: number }) {
  return (
    <span
      className="aspect-card relative block rounded-[3px]"
      style={{ background: OG.surface, border: `1px solid ${OG.surfaceBorder}` }}
    >
      {quantity !== undefined && (
        <span
          className="text-2xs absolute right-0.5 bottom-0.5 rounded-sm px-1 leading-tight tabular-nums"
          style={{ background: "rgba(8,9,12,0.82)", color: OG.text }}
        >
          ×{quantity}
        </span>
      )}
    </span>
  );
}

function OgImage() {
  return (
    <div
      className="flex aspect-[1200/630] flex-col gap-2 p-3"
      style={{ background: OG.background }}
    >
      <div className="flex items-baseline gap-2">
        <span className="truncate text-sm font-bold" style={{ color: OG.text }}>
          {DECK.name}
        </span>
        <span className="text-2xs shrink-0 font-semibold" style={{ color: OG.gold }}>
          {shareByline(DECK.owner)}
        </span>
        <span className="text-2xs ml-auto shrink-0" style={{ color: OG.muted }}>
          {deckMetaLabel(FORMAT_LABEL, DECK.cardCount)}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        <span
          className="aspect-card h-full rounded-[3px]"
          style={{ background: OG.surface, border: `1px solid ${OG.surfaceBorder}` }}
        />
        <div className="grid min-w-0 flex-1 grid-cols-6 gap-1">
          <OgTile quantity={3} />
          <OgTile />
          <OgTile quantity={2} />
          <OgTile />
          <OgTile />
          <OgTile quantity={3} />
        </div>
      </div>
      <span className="text-2xs shrink-0 font-semibold" style={{ color: OG.muted }}>
        {getSiteHost()}
      </span>
    </div>
  );
}

export function ShareVignette() {
  const shareUrl = `${getSiteUrl()}${DECK.sharePath}`;
  return (
    <Vignette>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(FAKE_CONTROL, "min-w-48 flex-1 truncate")}>{shareUrl}</span>
          <span
            aria-hidden="true"
            className={cn(buttonVariants({ variant: "outline" }), "relative")}
          >
            <span className="motion-safe:animate-share-before flex items-center gap-1.5 opacity-0">
              <CopyIcon className="size-4" />
              {m.common_copy()}
            </span>
            <span className="motion-safe:animate-share-after absolute inset-0 flex items-center justify-center gap-1.5">
              <CheckIcon className="size-4" />
              {m.common_copied()}
            </span>
          </span>
          <span aria-hidden="true" className={buttonVariants({ variant: "outline" })}>
            <ExternalLinkIcon />
            {m.share_open_link()}
          </span>
        </div>
        <OutputTabs />
        <QrCode value={shareUrl} size={96} label={m.share_qr_label_deck()} />
      </div>

      <div className="border-border/60 motion-safe:animate-share-unfurl overflow-hidden rounded-lg border">
        <OgImage />
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-muted-foreground text-2xs">{DECK.siteName}</span>
          <span className="truncate text-sm font-medium">
            {deckShareTitle(DECK.name, FORMAT_LABEL)}
          </span>
          <span className="text-muted-foreground text-xs">
            {deckShareDescription(FORMAT_LABEL, DECK.owner)}
          </span>
        </div>
      </div>
    </Vignette>
  );
}
