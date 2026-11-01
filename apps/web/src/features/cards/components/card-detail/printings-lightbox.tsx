import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { GalleryHorizontalIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { usePrintingVariantText } from "@/features/cards/hooks/use-printing-variant-text";
import {
  isSelectedSide,
  otherSideOf,
  sortByLanguagePreference,
} from "@/features/cards/lib/printing-designs";
import type { PrintingImageGroup } from "@/features/cards/lib/printing-image-groups";
import { groupPrintingImages } from "@/features/cards/lib/printing-image-groups";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { CardDetailArt } from "./card-detail-art";

const HISTORY_KEY = "printingLightbox";
const MAX_COLUMNS = 5;
const TILE_SIZES = "(min-width: 640px) 54vh, 100vw";
const TILE_WIDTH_CLASS =
  "w-[min(calc(100vw_-_3rem),calc((100dvh_-_13rem)_*_0.716))] sm:w-[min(calc(75dvh_*_0.716),calc((100dvh_-_13rem)_*_0.716),calc((100vw_-_4rem_-_(var(--tile-columns)_-_1)_*_1.5rem)_/_var(--tile-columns)))]";
const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

function columnsFor(count: number): number {
  return Math.ceil(count / Math.ceil(count / MAX_COLUMNS));
}

export function PrintingsLightbox({
  printing,
  printings,
  showImages,
  onSelect,
}: {
  printing: Printing;
  printings: Printing[];
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
}) {
  const languageOrder = useEffectiveLanguageOrder();
  const [open, setOpen] = useState(false);
  useOverlayHistoryEntry({ active: open, stateKey: HISTORY_KEY, onPop: () => setOpen(false) });

  const { count, groups } = groupPrintingImages(
    sortByLanguagePreference(printings, languageOrder),
    sideKey(printing),
  );
  if (groups.length < 2) {
    return null;
  }

  const close = () => closeOverlayHistoryEntry(HISTORY_KEY, () => setOpen(false));
  const handleSelect = (picked: Printing) => {
    onSelect(picked);
    close();
  };

  return (
    <>
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <GalleryHorizontalIcon />
          {m.card_detail_all_printings({ count })}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
      >
        {open && (
          <LightboxContent
            printing={printing}
            count={count}
            groups={groups}
            showImages={showImages}
            onSelect={handleSelect}
          />
        )}
      </Dialog>
    </>
  );
}

function LightboxContent({
  printing,
  count,
  groups,
  showImages,
  onSelect,
}: {
  printing: Printing;
  count: number;
  groups: PrintingImageGroup[];
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedKey = sideKey(printing);
  const isSelected = (group: PrintingImageGroup) =>
    group.printings.some((member) => isSelectedSide(member, selectedKey));
  const [position, setPosition] = useState(() =>
    Math.max(
      0,
      groups.findIndex((group) => isSelected(group)),
    ),
  );
  const leads = groups.flatMap((group) => group.printings);
  const columnStyle = { "--tile-columns": columnsFor(groups.length) } as CSSProperties;

  const tiles = () => [
    ...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-lightbox-tile]") ?? []),
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      return;
    }
    // useGridKeyboardNav listens on window and the detail dialog on its popup; neither may see these.
    event.stopPropagation();
    if (!NAV_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    const all = tiles();
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? all.indexOf(active) : -1;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? all.length - 1
          : Math.min(all.length - 1, Math.max(0, current + step));
    const tile = all[target];
    tile?.focus();
    tile?.scrollIntoView({ block: "nearest", inline: "center" });
  };

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    const distances = tiles().map((tile) =>
      Math.abs(tile.offsetLeft + tile.offsetWidth / 2 - center),
    );
    setPosition(distances.indexOf(Math.min(...distances)));
  };

  return (
    <DialogContent
      showCloseButton={false}
      initialFocus={() =>
        scrollerRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? true
      }
      onKeyDown={handleKeyDown}
      className="dark text-foreground fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black/90 p-0 shadow-none ring-0 sm:max-w-none"
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
        <div className="min-w-0 flex-1 space-y-1">
          <DialogTitle className="truncate">{legendDisplayName(printing.card)}</DialogTitle>
          <DialogDescription>{m.cards_printings_count({ count })}</DialogDescription>
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={m.common_close()}
        >
          <XIcon />
        </DialogClose>
      </div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        style={columnStyle}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-contain px-6 pt-4 pb-4 sm:flex-wrap sm:content-start sm:justify-center sm:gap-6 sm:overflow-x-hidden sm:overflow-y-auto"
      >
        {groups.map((group) => (
          <LightboxTile
            key={group.key}
            group={group}
            leads={leads}
            selected={isSelected(group)}
            showImages={showImages}
            onSelect={onSelect}
          />
        ))}
      </div>
      <p className="text-muted-foreground pb-4 text-center text-sm tabular-nums sm:hidden">
        {m.card_detail_lightbox_position({ index: position + 1, count: groups.length })}
      </p>
    </DialogContent>
  );
}

function LightboxTile({
  group,
  leads,
  selected,
  showImages,
  onSelect,
}: {
  group: PrintingImageGroup;
  leads: Printing[];
  selected: boolean;
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
}) {
  const { printing } = group;
  const { printingsByCardId } = useCards();
  const { labels } = useEnumOrders();
  const variantText = usePrintingVariantText();
  const [showBack, setShowBack] = useState(false);

  const other = printing.otherSide;
  const backEntry = other
    ? otherSideOf(printing, printingsByCardId.get(other.cardId) ?? [])
    : undefined;
  const merged = group.printings.length > 1;
  // Merged tiles list their finishes on a line of their own; the variant label must not repeat them.
  const labelSiblings = merged
    ? leads.map((lead) => ({ ...lead, finish: printing.finish }))
    : leads;
  const frontArt = (
    <CardDetailArt printing={printing} showImages={showImages} disableTilt sizes={TILE_SIZES} />
  );
  const backArt = backEntry && (
    <CardDetailArt printing={backEntry} showImages={showImages} disableTilt sizes={TILE_SIZES} />
  );
  const flipTarget = showBack ? printing : backEntry;

  const image = (
    <Pressable
      data-lightbox-tile=""
      aria-pressed={selected}
      aria-label={variantText(printing, labelSiblings)}
      onClick={() => onSelect(printing)}
      className={cn(
        "block w-full min-w-0 rounded-[5%/3.6%]",
        selected && "outline-primary outline-2 outline-offset-4",
      )}
    >
      {showBack ? backArt : frontArt}
    </Pressable>
  );

  return (
    <div className={cn("flex shrink-0 snap-center flex-col gap-2 text-sm", TILE_WIDTH_CLASS)}>
      {other && backEntry && flipTarget ? (
        <DoubleSidedFlip
          key={String(showBack)}
          otherSide={{ ...other, cardName: legendDisplayName(flipTarget.card) }}
          back={showBack ? frontArt : backArt}
          onFlip={() => setShowBack(!showBack)}
        >
          {image}
        </DoubleSidedFlip>
      ) : (
        image
      )}
      <div className="space-y-0.5 px-1">
        <PrintingVariantLine printing={printing} siblings={labelSiblings} publicCode />
        <p className="text-muted-foreground">
          {m.card_detail_lightbox_artist({ artist: printing.artist })}
        </p>
        {merged && (
          <p className="text-muted-foreground">
            {group.finishes.map((finish) => enumLabel(labels.finishes, finish)).join(", ")}
          </p>
        )}
        {other && other.cardId !== printing.cardId && (
          <p className="text-muted-foreground">
            {m.card_detail_lightbox_back({ name: other.cardName })}
          </p>
        )}
      </div>
    </div>
  );
}
