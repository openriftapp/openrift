import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { GalleryHorizontalIcon, TableIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { LanguageChip } from "@/components/language-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PrintingLanguageMatrix } from "@/features/cards/components/card-page-printings";
import { DoubleSidedFlip } from "@/features/cards/components/double-sided-flip";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { usePrintingVariantText } from "@/features/cards/hooks/use-printing-variant-text";
import { lightboxPrintingsInLanguage } from "@/features/cards/lib/lightbox-printings";
import {
  groupPrintingDesigns,
  isSelectedSide,
  otherSideOf,
  sortByLanguagePreference,
} from "@/features/cards/lib/printing-designs";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useLanguageLabels } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  const requestedSideKey = usePrintingLightboxStore((state) => state.requestedSideKey);
  const shownSideKey = sideKey(printing);
  const sorted = sortByLanguagePreference(printings, languageOrder);
  const hasTiles = lightboxPrintingsInLanguage(sorted).length > 1;

  useEffect(() => {
    if (requestedSideKey !== null && requestedSideKey === shownSideKey) {
      usePrintingLightboxStore.getState().clear();
      // oxlint-disable-next-line react/set-state-in-effect -- opening a commit later pushes this history entry above the detail's
      setOpen(hasTiles);
    }
  }, [requestedSideKey, shownSideKey, hasTiles]);

  if (!hasTiles) {
    return null;
  }

  const close = () => closeOverlayHistoryEntry(HISTORY_KEY, () => setOpen(false));
  const handleSelect = (picked: Printing) => {
    usePrintingLightboxStore.getState().pick(sideKey(picked));
    closeOverlayHistoryEntry(
      HISTORY_KEY,
      () => setOpen(false),
      () => onSelect(picked),
    );
  };

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        <GalleryHorizontalIcon />
        {m.card_detail_all_printings()}
      </Button>
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
            printings={sorted}
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
  printings,
  showImages,
  onSelect,
}: {
  printing: Printing;
  printings: Printing[];
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const languageLabels = useLanguageLabels();
  const { languages } = groupPrintingDesigns(printings);
  const [language, setLanguage] = useState<string | undefined>(() =>
    languages.includes(printing.language) ? printing.language : undefined,
  );
  const isMobile = useIsMobile();
  const [view, setView] = useState<"cards" | "table">(() => (isMobile ? "cards" : "table"));
  const tiles = lightboxPrintingsInLanguage(printings, view === "table" ? undefined : language);
  const selectedKey = sideKey(printing);
  const selectedIndex = (shown: readonly Printing[]) =>
    Math.max(
      0,
      shown.findIndex((tile) => isSelectedSide(tile, selectedKey)),
    );
  const [position, setPosition] = useState(() => selectedIndex(tiles));

  const handleLanguageChange = (next?: string) => {
    if (next === language) {
      return;
    }
    setLanguage(next);
    setPosition(selectedIndex(lightboxPrintingsInLanguage(printings, next)));
    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
  };
  const columnStyle = { "--tile-columns": columnsFor(tiles.length) } as CSSProperties;

  const tileElements = () => [
    ...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-lightbox-tile]") ?? []),
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      return;
    }
    // useGridKeyboardNav listens on window and the detail dialog on its popup; neither may see these.
    event.stopPropagation();
    if (view === "table" || !NAV_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    const all = tileElements();
    const active = document.activeElement;
    const current = all.findIndex((tile) => tile.closest("[data-lightbox-cell]")?.contains(active));
    const fromOutsideTiles = current === -1 && event.key.startsWith("Arrow");
    const tile = all[fromOutsideTiles ? position : lightboxKeyTarget(event.key, all, current)];
    tile?.focus();
    tile?.scrollIntoView({ block: "nearest", inline: "center" });
  };

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    const distances = tileElements().map((tile) =>
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2 sm:px-6">
        <div className="min-w-0 flex-1 space-y-1">
          <DialogTitle className="truncate">{legendDisplayName(printing.card)}</DialogTitle>
          <DialogDescription>{m.cards_printings_count({ count: tiles.length })}</DialogDescription>
        </div>
        {view === "cards" && languages.length > 1 && (
          <div
            role="group"
            aria-label={m.card_detail_lightbox_language_aria()}
            className="order-last flex basis-full flex-wrap justify-center gap-1.5 sm:order-none sm:basis-auto sm:justify-end"
          >
            <Pressable
              aria-pressed={language === undefined}
              onClick={() => handleLanguageChange()}
              className="rounded-full"
            >
              <Badge
                variant="outline"
                className={cn("text-2xs h-4 px-1.5", language !== undefined && "opacity-60")}
              >
                {m.common_all()}
              </Badge>
            </Pressable>
            {languages.map((code) => (
              <Pressable
                key={code}
                aria-pressed={code === language}
                aria-label={enumLabel(languageLabels, code)}
                onClick={() => handleLanguageChange(code)}
                className="rounded-full"
              >
                <LanguageChip code={code} className={cn(code !== language && "opacity-60")} />
              </Pressable>
            ))}
          </div>
        )}
        <ToggleGroup
          aria-label={m.cards_display_mode()}
          variant="control"
          size="sm"
          spacing={0}
          value={[view]}
          onValueChange={([next]) => {
            if (next === "cards" || next === "table") {
              setView(next);
            }
          }}
        >
          <ToggleGroupItem value="cards" className="gap-1.5 text-xs">
            <GalleryHorizontalIcon />
            {m.card_detail_lightbox_view_images()}
          </ToggleGroupItem>
          <ToggleGroupItem value="table" className="gap-1.5 text-xs">
            <TableIcon />
            {m.cards_table()}
          </ToggleGroupItem>
        </ToggleGroup>
        <DialogClose
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={m.common_close()}
        >
          <XIcon />
        </DialogClose>
      </div>
      {view === "table" ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 sm:px-6">
          <div className="mx-auto w-full sm:w-fit sm:max-w-full">
            <PrintingLanguageMatrix
              printings={printings}
              selectedSideKey={selectedKey}
              onSelect={onSelect}
              showImages={showImages}
            />
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            style={columnStyle}
            className="relative flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-contain px-6 pt-4 pb-4 sm:flex-wrap sm:content-start sm:justify-center sm:gap-6 sm:overflow-x-hidden sm:overflow-y-auto"
          >
            {tiles.map((tile) => (
              <LightboxTile
                key={sideKey(tile)}
                printing={tile}
                siblings={tiles}
                selected={isSelectedSide(tile, selectedKey)}
                showImages={showImages}
                onSelect={onSelect}
              />
            ))}
          </div>
          <p className="text-muted-foreground pb-4 text-center text-sm tabular-nums sm:hidden">
            {m.card_detail_lightbox_position({ index: position + 1, count: tiles.length })}
          </p>
        </>
      )}
    </DialogContent>
  );
}

export function lightboxKeyTarget(
  key: string,
  tiles: readonly Pick<HTMLElement, "offsetTop" | "offsetLeft" | "offsetWidth">[],
  current: number,
): number {
  const last = tiles.length - 1;
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return last;
  }
  const step = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
  const from = tiles[current];
  if ((key === "ArrowUp" || key === "ArrowDown") && from) {
    const center = (tile: (typeof tiles)[number]) => tile.offsetLeft + tile.offsetWidth / 2;
    const rows = tiles.filter((tile) =>
      step === 1 ? tile.offsetTop > from.offsetTop : tile.offsetTop < from.offsetTop,
    );
    if (rows.length > 0) {
      const rowTop =
        step === 1
          ? Math.min(...rows.map((tile) => tile.offsetTop))
          : Math.max(...rows.map((tile) => tile.offsetTop));
      const row = rows.filter((tile) => tile.offsetTop === rowTop);
      const distances = row.map((tile) => Math.abs(center(tile) - center(from)));
      const nearest = row[distances.indexOf(Math.min(...distances))];
      return nearest ? tiles.indexOf(nearest) : current;
    }
    if (tiles.some((tile) => tile.offsetTop !== from.offsetTop)) {
      return current;
    }
  }
  return Math.min(last, Math.max(0, current + step));
}

function LightboxTile({
  printing,
  siblings,
  selected,
  showImages,
  onSelect,
}: {
  printing: Printing;
  siblings: Printing[];
  selected: boolean;
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
}) {
  const { printingsByCardId } = useCards();
  const variantText = usePrintingVariantText();
  const [showBack, setShowBack] = useState(false);

  const other = printing.otherSide;
  const backEntry = other
    ? otherSideOf(printing, printingsByCardId.get(other.cardId) ?? [])
    : undefined;
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
      aria-label={variantText(printing, siblings)}
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
    <div
      data-lightbox-cell=""
      className={cn("flex shrink-0 snap-center flex-col gap-2 text-sm", TILE_WIDTH_CLASS)}
    >
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
        <PrintingVariantLine printing={printing} siblings={siblings} publicCode />
        <p className="text-muted-foreground">
          {m.card_detail_lightbox_artist({ artist: printing.artist })}
        </p>
        {other && other.cardId !== printing.cardId && (
          <p className="text-muted-foreground">
            {m.card_detail_lightbox_back({ name: other.cardName })}
          </p>
        )}
      </div>
    </div>
  );
}
