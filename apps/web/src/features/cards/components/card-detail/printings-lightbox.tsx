import { legendDisplayName } from "@openrift/shared/card-name";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { ChevronLeftIcon, GalleryHorizontalIcon, TableIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import {
  DesignDetails,
  PrintingLanguageMatrix,
} from "@/features/cards/components/card-page-printings";
import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCatalogTailStatus } from "@/features/cards/hooks/use-cards";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { usePrintingVariantText } from "@/features/cards/hooks/use-printing-variant-text";
import { lightboxPrintingsInLanguage } from "@/features/cards/lib/lightbox-printings";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import {
  groupPrintingDesigns,
  isSelectedSide,
  sortByLanguagePreference,
} from "@/features/cards/lib/printing-designs";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { PrintingArt } from "./printing-art";
import { OwnedPill, WithPrintingStats } from "./printing-stats";
import type { CellStats } from "./printing-stats";
import { usePrintingsHost } from "./printings-host";

const HISTORY_KEY = "printingLightbox";
const MAX_COLUMNS = 5;
const TILE_SIZES = "(min-width: 640px) 54vh, 100vw";
const TILE_WIDTH_CLASS =
  "w-[min(calc(100vw_-_3rem),calc((100dvh_-_13rem)_*_var(--aspect-card)))] sm:w-[min(calc(75dvh_*_var(--aspect-card)),calc((100dvh_-_13rem)_*_var(--aspect-card)),calc((100vw_-_4rem_-_(var(--tile-columns)_-_1)_*_1.5rem)_/_var(--tile-columns)))]";
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
  const host = usePrintingsHost();
  const setHostExpanded = host?.setExpanded;
  const hostExpanded = host?.expanded;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const awaitingShrinkRef = useRef(false);

  useEffect(() => {
    if (!open || !setHostExpanded) {
      return;
    }
    setHostExpanded(true);
    return () => setHostExpanded(false);
  }, [open, setHostExpanded]);

  // The trigger is inert until the host has shrunk, so focus can only return a commit later.
  useEffect(() => {
    if (open) {
      awaitingShrinkRef.current = true;
    } else if (awaitingShrinkRef.current && hostExpanded === false) {
      awaitingShrinkRef.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open, hostExpanded]);

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

  const content = open && (
    <LightboxContent
      printing={printing}
      printings={sorted}
      showImages={showImages}
      onSelect={handleSelect}
      onClose={host ? close : undefined}
      slides={host?.slides}
    />
  );

  return (
    <>
      <Button ref={triggerRef} variant="ghost" size="xs" onClick={() => setOpen(true)}>
        <GalleryHorizontalIcon />
        {m.card_detail_all_printings()}
      </Button>
      {host ? (
        content && host.expanded && host.slot && createPortal(content, host.slot)
      ) : (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) {
              close();
            }
          }}
        >
          {content}
        </Dialog>
      )}
    </>
  );
}

function LightboxContent({
  printing,
  printings,
  showImages,
  onSelect,
  onClose,
  slides,
}: {
  printing: Printing;
  printings: Printing[];
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
  onClose?: () => void;
  slides?: boolean;
}) {
  const inline = onClose !== undefined;
  const rootRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { languages, designs } = groupPrintingDesigns(printings);
  const isMobile = useIsMobile();
  const [language, setLanguage] = useState<string>();
  const [designKey, setDesignKey] = useState<string>();
  const designTiles = (key?: string) => {
    const design = designs.find((entry) => entry.key === key);
    return design ? [...design.byLanguage.values()] : undefined;
  };
  const showTiles =
    isMobile && (language !== undefined || designKey !== undefined || languages.length === 1);
  const tiles = designTiles(designKey) ?? lightboxPrintingsInLanguage(printings, language);
  const selectedKey = sideKey(printing);
  const selectedIndex = (shown: readonly Printing[]) =>
    Math.max(
      0,
      shown.findIndex((tile) => isSelectedSide(tile, selectedKey)),
    );
  const [position, setPosition] = useState(() => selectedIndex(tiles));

  const handleLanguageChange = (next?: string) => {
    if (next === language && designKey === undefined) {
      return;
    }
    setLanguage(next);
    setDesignKey(undefined);
    setPosition(selectedIndex(lightboxPrintingsInLanguage(printings, next)));
    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
  };
  const handleDesignSelect = (key: string) => {
    setDesignKey(key);
    setLanguage(undefined);
    setPosition(selectedIndex(designTiles(key) ?? []));
    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
  };
  const columnStyle = { "--tile-columns": columnsFor(tiles.length) } as CSSProperties;

  const tileElements = () => [
    ...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-lightbox-tile]") ?? []),
  ];
  // Matrix cells sit in different offset parents, so positions come from the viewport.
  const tileBoxes = (elements: HTMLElement[]) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        offsetTop: Math.round(box.top),
        offsetLeft: Math.round(box.left),
        offsetWidth: Math.round(box.width),
      };
    });

  // Switching views unmounts the focused control; focus must stay inside for Escape to shrink.
  useEffect(() => {
    const root = rootRef.current;
    if (!inline || !root || root.contains(document.activeElement)) {
      return;
    }
    (
      root.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      root.querySelector("button") ??
      root
    ).focus();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the view state only triggers the refocus
  }, [inline, showTiles, language, designKey]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onClose) {
      // The host surface is itself a dialog or drawer that would close on the same key.
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      return;
    }
    // useGridKeyboardNav listens on window and the detail dialog on its popup; neither may see these.
    event.stopPropagation();
    if (!NAV_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    const all = tileElements();
    const active = document.activeElement;
    const current = all.findIndex((tile) =>
      (tile.closest("[data-lightbox-cell]") ?? tile).contains(active),
    );
    const fromOutsideTiles = current === -1 && event.key.startsWith("Arrow");
    const start = showTiles ? position : 0;
    const tile =
      all[fromOutsideTiles ? start : lightboxKeyTarget(event.key, tileBoxes(all), current)];
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

  const renderTiles = (stats?: CellStats) =>
    tiles.map((tile) => (
      <LightboxTile
        key={sideKey(tile)}
        printing={tile}
        design={designs.find((entry) => [...entry.byLanguage.values()].includes(tile))}
        siblings={tiles}
        selected={isSelectedSide(tile, selectedKey)}
        showImages={showImages}
        onSelect={onSelect}
        stats={stats}
      />
    ));

  const title = legendDisplayName(printing.card);
  const count = m.cards_printings_count({ count: tiles.length });
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2 sm:px-6">
        {onClose && slides && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={m.common_back()}>
            <ChevronLeftIcon />
          </Button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {inline ? (
            <>
              <h2 className="truncate font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm">{count}</p>
            </>
          ) : (
            <>
              <DialogTitle className="truncate">{title}</DialogTitle>
              <DialogDescription>{count}</DialogDescription>
            </>
          )}
        </div>
        {showTiles && languages.length > 1 && (
          <Button variant="ghost" size="xs" onClick={() => handleLanguageChange()}>
            <TableIcon />
            {m.card_detail_lightbox_show_overview()}
          </Button>
        )}
        {onClose && !slides && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={m.common_close()}>
            <XIcon />
          </Button>
        )}
        {!inline && (
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label={m.common_close()}
          >
            <XIcon />
          </DialogClose>
        )}
      </div>
      <CatalogTailNote />
      {showTiles ? null : (
        <div
          ref={scrollerRef}
          className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6"
        >
          <div className="mx-auto w-full pt-2 sm:w-fit sm:max-w-full">
            <PrintingLanguageMatrix
              printings={printings}
              stickyHeader
              onLanguageSelect={isMobile ? handleLanguageChange : undefined}
              onDesignSelect={isMobile ? handleDesignSelect : undefined}
              onSelect={onSelect}
              showImages={showImages}
            />
          </div>
        </div>
      )}
      {showTiles && (
        <>
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            style={columnStyle}
            className="relative flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-contain px-6 pt-4 pb-4 sm:flex-wrap sm:content-start sm:justify-center sm:gap-6 sm:overflow-x-hidden sm:overflow-y-auto"
          >
            <WithPrintingStats printingIds={tiles.map((tile) => tile.printingId)}>
              {renderTiles}
            </WithPrintingStats>
          </div>
          <p className="text-muted-foreground pb-4 text-center text-sm tabular-nums sm:hidden">
            {m.card_detail_lightbox_position({ index: position + 1, count: tiles.length })}
          </p>
        </>
      )}
    </>
  );

  if (inline) {
    return (
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrow keys and Escape for the tiles inside, as on the dialog popup
      <section
        ref={rootRef}
        tabIndex={-1}
        aria-label={title}
        onKeyDown={handleKeyDown}
        className="text-foreground flex h-full min-h-0 flex-col"
      >
        {body}
      </section>
    );
  }
  return (
    <DialogContent
      showCloseButton={false}
      initialFocus={() =>
        scrollerRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? true
      }
      onKeyDown={handleKeyDown}
      className="dark text-foreground fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black/90 p-0 shadow-none ring-0 sm:max-w-none"
    >
      {body}
    </DialogContent>
  );
}

function CatalogTailNote() {
  const { status, retry } = useCatalogTailStatus();
  if (status === "complete") {
    return null;
  }
  return (
    <p role="status" className="text-muted-foreground px-4 pb-2 text-sm sm:px-6">
      {status === "failed" ? (
        <>
          {m.card_detail_lightbox_languages_failed()}{" "}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
            {m.common_retry()}
          </Button>
        </>
      ) : (
        m.card_detail_lightbox_languages_loading()
      )}
    </p>
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
  design,
  siblings,
  selected,
  showImages,
  onSelect,
  stats,
}: {
  printing: Printing;
  design?: PrintingDesign;
  siblings: Printing[];
  selected: boolean;
  showImages?: boolean;
  onSelect: (printing: Printing) => void;
  stats?: CellStats;
}) {
  const variantText = usePrintingVariantText();
  const other = printing.otherSide;

  return (
    <div
      data-lightbox-cell=""
      className={cn("flex shrink-0 snap-center flex-col gap-2 text-sm", TILE_WIDTH_CLASS)}
    >
      <PrintingArt
        printing={printing}
        showImages={showImages}
        sizes={TILE_SIZES}
        frame={(art) => (
          <Pressable
            data-lightbox-tile=""
            aria-pressed={selected}
            aria-label={variantText(printing, siblings)}
            onClick={() => onSelect(printing)}
            className="rounded-card relative block w-full min-w-0"
          >
            {art}
            <OwnedPill floating count={stats?.owned?.[printing.printingId]} />
          </Pressable>
        )}
      />
      <div className="space-y-0.5 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0">
            <PrintingVariantLine printing={printing} siblings={siblings} publicCode />
          </span>
          {stats && (
            <span className="shrink-0 font-semibold tabular-nums">
              {stats.price(printing.printingId)}
            </span>
          )}
        </div>
        {design && <DesignDetails design={design} />}
        {other && other.cardId !== printing.cardId && (
          <p className="text-muted-foreground">
            {m.card_detail_lightbox_back({ name: other.cardName })}
          </p>
        )}
      </div>
    </div>
  );
}
