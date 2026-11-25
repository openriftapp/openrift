import { useDraggable } from "@dnd-kit/core";
import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import { errataForLanguage } from "@openrift/shared/errata";
import { cardBansFor, standardSetLegality } from "@openrift/shared/format-legality";
import { imageSrcSet, imageUrl } from "@openrift/shared/image-url";
import { sideKey } from "@openrift/shared/printing-side";
import type { StandardArtFallback } from "@openrift/shared/standard";
import type { Printing, PrintingOtherSide } from "@openrift/shared/types/catalog";
import type { Domain, Rarity } from "@openrift/shared/types/enums";
import { WellKnown, isBaseBanFormat, isFoilFinish } from "@openrift/shared/well-known";
import { useRouter } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { memo, use, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { Pressable } from "@/components/ui/pressable";
import { CardMetaLabel } from "@/features/cards/components/card-meta-label";
import { CardPlaceholderImage } from "@/features/cards/components/card-placeholder-image";
import { BanRibbon, CornerRibbon } from "@/features/cards/components/card-ribbons";
import { FallbackArtBadges } from "@/features/cards/components/fallback-art-badges";
import { FoilOverlay } from "@/features/cards/components/foil-overlay";
import { SuggestImageNotice } from "@/features/cards/components/suggest-image-notice";
import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import {
  BUTTON_PAD_CLASS,
  CARD_BORDER_RADIUS,
  LABEL_WRAPPER_MT_CLASS,
} from "@/features/cards/lib/card-grid-constants";
import { otherSideName, printingName } from "@/features/cards/lib/card-meta";
import { isPlainPrimaryClick } from "@/features/cards/lib/card-row-interactions";
import { OtherSideContext } from "@/features/cards/lib/other-side-context";
import { groupPrintingDesigns } from "@/features/cards/lib/printing-designs";
import { NO_TILE_ART, tileArt } from "@/features/cards/lib/tile-art";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useViewerLegality } from "@/hooks/use-viewer-legality";
import { getDomainGradientStyle } from "@/lib/domain";
import { priceColorClass } from "@/lib/format";
import { LANDSCAPE_ROTATION_STYLE, needsCssRotation } from "@/lib/images";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const CARD_WIDTH = 630;
const CARD_HEIGHT = 880;

function promoMarkerLabel(printing: Printing): string | undefined {
  return printing.markers.find((marker) => marker.slug === WellKnown.marker.PROMO)?.label;
}

export const AFTER_BORDER =
  "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border-card-edge after:border";

const SHELL_INNER_CLASS = cn("relative", AFTER_BORDER, "hover:ring-primary/60 hover:ring-2");

const MAX_CLOSED_STACK_EDGES = 5;

function ImageShell({
  children,
  badge,
  selected,
}: {
  children: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(SHELL_INNER_CLASS, selected && "ring-primary hover:ring-primary ring-2")}
      style={{ borderRadius: CARD_BORDER_RADIUS }}
    >
      {children}
      {badge}
    </div>
  );
}

// Caller keeps overflow-hidden and the preserve-3d transform on separate elements
// around this, or Firefox mis-sizes the rotated-image overlay on stacked layers.
// data-loaded is written directly by the load handler, not React state, so a
// filter swap of ~25 images doesn't re-render each cell; key={thumbnailUrl} resets it.
const FADE_IN_CLASS = "opacity-0 transition-opacity duration-300 data-[loaded]:opacity-100";

function markLoaded(node: HTMLImageElement): void {
  node.dataset.loaded = "";
}

function CardArtImage({
  thumbnailUrl,
  srcSet,
  sizes,
  alt,
  rotated,
  loading,
  fetchPriority,
  fade,
  onError,
}: {
  thumbnailUrl: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  rotated: boolean;
  loading: "eager" | "lazy";
  fetchPriority?: "high";
  /** Off for priority images: they're already SSR-painted, so a transparent start flashes on hydration. */
  fade?: boolean;
  onError?: () => void;
}) {
  /**
   * Covers cached/instant results: the browser can fire load/error before React
   * attaches listeners. A broken image has `complete` set with naturalWidth 0.
   */
  const coverCachedResult = (node: HTMLImageElement | null) => {
    if (node?.complete) {
      if (node.naturalWidth > 0) {
        markLoaded(node);
      } else {
        onError?.();
      }
    }
  };
  const imgClass = fade ? FADE_IN_CLASS : undefined;
  return rotated ? (
    <div className="absolute top-1/2 left-1/2 overflow-hidden" style={LANDSCAPE_ROTATION_STYLE}>
      <img
        key={thumbnailUrl}
        ref={coverCachedResult}
        src={thumbnailUrl}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={CARD_HEIGHT}
        height={CARD_WIDTH}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={cn("size-full object-cover", imgClass)}
        onLoad={(event) => markLoaded(event.currentTarget)}
        onError={onError}
      />
    </div>
  ) : (
    <img
      key={thumbnailUrl}
      ref={coverCachedResult}
      src={thumbnailUrl}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      className={cn("size-full object-cover", imgClass)}
      onLoad={(event) => markLoaded(event.currentTarget)}
      onError={onError}
    />
  );
}

function CardImageContent({
  thumbnailUrl,
  srcSet,
  sizes,
  alt,
  priority,
  rotated,
  rarity,
  publicCode,
  artist,
  promoLabel,
  card,
  showFoil,
  fallbackArt,
}: {
  thumbnailUrl: string | null;
  srcSet: string | undefined;
  sizes: string | undefined;
  alt: string;
  priority: boolean;
  rotated: boolean;
  rarity: Rarity;
  publicCode: string;
  artist: string;
  promoLabel: string | undefined;
  card: {
    name: string;
    domains: Domain[];
    energy: number | null;
    might?: number | null;
    power?: number | null;
    types?: string[];
    superTypes?: string[];
    tags?: string[];
    rulesText?: string | null;
    effectText?: string | null;
    mightBonus?: number | null;
    flavorText?: string | null;
  };
  showFoil: boolean;
  /** Substitute artwork tried before the drawn placeholder; overlay marks what the borrowed art doesn't depict. */
  fallbackArt: { imageId: string; overlay: ReactNode } | null;
}) {
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);
  const markFailed = (url: string) =>
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  const artUrl = thumbnailUrl !== null && !failedUrls.includes(thumbnailUrl) ? thumbnailUrl : null;
  const fallbackCandidate =
    fallbackArt === null ? null : { ...fallbackArt, url: imageUrl(fallbackArt.imageId, "400w") };
  const shownFallback =
    artUrl === null && fallbackCandidate !== null && !failedUrls.includes(fallbackCandidate.url)
      ? fallbackCandidate
      : null;
  const drawnPlaceholder = (
    <CardPlaceholderImage
      name={card.name}
      domain={card.domains}
      energy={card.energy}
      might={card.might}
      power={card.power}
      types={card.types}
      superTypes={card.superTypes}
      tags={card.tags}
      rulesText={card.rulesText}
      effectText={card.effectText}
      mightBonus={card.mightBonus}
      flavorText={card.flavorText}
      rarity={rarity}
      publicCode={publicCode}
      artist={artist}
      promoLabel={promoLabel}
    />
  );
  // Empty alt marks decorative sibling faces, so the placeholder's role="img" label
  // doesn't pollute the accessible name of the parent control they sit inside.
  const placeholder =
    alt === "" ? <div aria-hidden="true">{drawnPlaceholder}</div> : drawnPlaceholder;
  return (
    <>
      {artUrl ? (
        <CardArtImage
          thumbnailUrl={artUrl}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          rotated={rotated}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          fade={!priority}
          onError={() => markFailed(artUrl)}
        />
      ) : shownFallback ? (
        <>
          <CardArtImage
            thumbnailUrl={shownFallback.url}
            srcSet={imageSrcSet(shownFallback.imageId)}
            sizes={sizes}
            alt={alt}
            rotated={rotated}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            fade={!priority}
            onError={() => markFailed(shownFallback.url)}
          />
          {shownFallback.overlay}
        </>
      ) : (
        placeholder
      )}
      {showFoil && <FoilOverlay active />}
    </>
  );
}

function doubleSidedHint(printing: Printing): string | undefined {
  const other = printing.otherSide;
  if (!other) {
    return undefined;
  }
  return other.cardId === printing.cardId
    ? m.cards_printing_same_both_sides({ name: otherSideName(other) })
    : m.cards_thumb_double_sided_with({ name: otherSideName(other) });
}

const INSET_CLASS =
  "bg-muted ring-background aspect-card absolute right-[5%] bottom-[4%] z-[11] flex w-[30%] items-center justify-center rounded-sm shadow-md ring-2";

function OtherSideInset({
  otherSide,
  showFoil,
  dimmed,
  rotated,
  onFlip,
}: {
  otherSide: PrintingOtherSide;
  showFoil: boolean;
  dimmed?: boolean;
  rotated?: boolean;
  onFlip?: () => void;
}) {
  const image = otherSide.imageId ? (
    <img
      src={imageUrl(otherSide.imageId, "240w")}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-full rounded-sm object-cover"
    />
  ) : undefined;
  const art =
    image && rotated ? (
      <div className="absolute top-1/2 left-1/2" style={LANDSCAPE_ROTATION_STYLE}>
        {image}
      </div>
    ) : (
      image
    );
  const content = (
    <>
      {art ?? (
        <span className="text-2xs text-muted-foreground px-0.5 text-center">
          {otherSideName(otherSide)}
        </span>
      )}
      {showFoil && <FoilOverlay active dim />}
    </>
  );
  if (!onFlip) {
    return (
      <div
        aria-hidden="true"
        className={cn(INSET_CLASS, "pointer-events-none overflow-hidden", dimmed && "opacity-50")}
      >
        {content}
      </div>
    );
  }
  return (
    <Pressable
      aria-label={m.cards_flip_to_other_side({ name: otherSideName(otherSide) })}
      className={cn(
        INSET_CLASS,
        "transition-transform before:absolute before:-inset-1 before:content-[''] hover:scale-105 pointer-coarse:before:-inset-3",
        dimmed && "opacity-50",
      )}
      onClick={onFlip}
    >
      {content}
    </Pressable>
  );
}

function displayCard(printing: Printing) {
  return {
    ...printing.card,
    name: printingName(printing, printing.card),
    rulesText: printing.printedRulesText,
    effectText: printing.printedEffectText,
    flavorText: printing.flavorText,
  };
}

function fallbackArtStep(printing: Printing, fallback: StandardArtFallback | null) {
  if (fallback === null) {
    return null;
  }
  return {
    imageId: fallback.image.imageId,
    overlay: <FallbackArtBadges printing={printing} artPrinting={fallback.printing} />,
  };
}

function siblingFallbackArt(fallback: StandardArtFallback | null) {
  return fallback === null ? null : { imageId: fallback.image.imageId, overlay: null };
}

interface CardThumbnailProps {
  printing: Printing;
  onClick: (printing: Printing, event?: ReactMouseEvent) => void;
  onSiblingClick?: (printing: Printing) => void;
  showImages?: boolean;
  selected?: boolean;
  isFlashing?: boolean;
  siblings?: Printing[];
  priceRange?: { min: number; max: number };
  view?: "cards" | "printings";
  otherSideInset?: boolean;
  cardWidth?: number;
  /** Ignored when `cardWidth` is provided; the pixel-precise value wins. */
  sizes?: string;
  priority?: boolean;
  display: CardThumbnailDisplay;
  aboveCard?: ReactNode;
  dimmed?: boolean;
  dragData?: Record<string, unknown>;
  /** Required when dragData is set. */
  dragId?: string;
  dragBlockedLabel?: string;
  banDisplay?: "label" | "overlay" | "none";
  belowLabel?: ReactNode;
  imageOverlay?: ReactNode;
  imageBadge?: ReactNode;
  href?: string;
  checked?: boolean;
  focusRequested?: boolean;
  onFocused?: () => void;
}

interface ImageTargetProps {
  ref?: (node: HTMLElement | null) => void;
  href: string | undefined;
  draggable: false | undefined;
  onClick: (event?: ReactMouseEvent) => void;
  className: string;
  style: CSSProperties;
  children: ReactNode;
  checked?: boolean;
}

function ImageTarget({
  ref,
  href,
  onClick,
  className,
  style,
  children,
  draggable,
  checked,
}: ImageTargetProps) {
  if (href === undefined) {
    return (
      <Pressable
        ref={ref}
        className={className}
        style={style}
        onClick={onClick}
        role={checked === undefined ? undefined : "checkbox"}
        aria-checked={checked}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <ImageLink
      ref={ref}
      href={href}
      draggable={draggable}
      onClick={onClick}
      className={className}
      style={style}
    >
      {children}
    </ImageLink>
  );
}

function ImageLink({
  ref,
  href,
  draggable,
  onClick,
  className,
  style,
  children,
}: ImageTargetProps & { href: string }) {
  const router = useRouter();
  const preloadTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(
    () => () => {
      if (preloadTimer.current) {
        clearTimeout(preloadTimer.current);
      }
    },
    [],
  );
  const cancelPreload = () => {
    if (preloadTimer.current) {
      clearTimeout(preloadTimer.current);
      preloadTimer.current = null;
    }
  };
  const preload = async () => {
    preloadTimer.current = null;
    try {
      await router.preloadRoute({ to: ".", href });
    } catch {
      // a failed preload only loses the head start
    }
  };
  const schedulePreload = () => {
    if (!preloadTimer.current) {
      preloadTimer.current = setTimeout(() => void preload(), router.options.defaultPreloadDelay);
    }
  };

  return (
    <a
      ref={ref}
      href={href}
      draggable={draggable}
      className={cn(
        "focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      style={style}
      onClick={(event) => {
        if (isPlainPrimaryClick(event)) {
          event.preventDefault();
          onClick(event);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === " " && !event.repeat) {
          event.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={schedulePreload}
      onFocus={schedulePreload}
      onMouseLeave={cancelPreload}
      onBlur={cancelPreload}
    >
      {children}
    </a>
  );
}

/** Only mounted when dragData is passed, so callers without drag pay zero @dnd-kit cost. */
function DraggableTileWrapper({
  dragId,
  dragData,
  blockedLabel,
  className,
  onMouseEnter,
  onMouseLeave,
  printingId,
  tileSideKey,
  children,
}: {
  dragId: string;
  dragData: Record<string, unknown>;
  blockedLabel?: string;
  className: string;
  onMouseEnter: (() => void) | undefined;
  onMouseLeave: (() => void) | undefined;
  printingId: string;
  tileSideKey: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const enableDrag = !isMobile;
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
    disabled: !enableDrag || blockedLabel !== undefined,
  });
  const blocked = enableDrag && blockedLabel !== undefined;
  return (
    <div
      ref={setNodeRef}
      data-printing-id={printingId}
      data-side-key={tileSideKey}
      className={cn(className, isDragging && "opacity-40", enableDrag && "select-none")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...(enableDrag ? listeners : {})}
      role={blocked ? "group" : undefined}
      aria-label={blocked ? blockedLabel : undefined}
    >
      {children}
    </div>
  );
}

// React Compiler cannot memoize JSX created inside the virtualizer's items.map() callback.
// oxlint-disable-next-line eslint/prefer-arrow-callback -- named for React DevTools
export const CardThumbnail = memo(function CardThumbnail({
  printing: entry,
  onClick,
  onSiblingClick,
  showImages,
  selected,
  isFlashing,
  siblings,
  priceRange,
  view,
  otherSideInset = true,
  cardWidth,
  sizes: sizesOverride,
  priority,
  display,
  aboveCard,
  dimmed,
  dragData,
  dragId,
  dragBlockedLabel,
  banDisplay = "label",
  belowLabel,
  imageOverlay,
  imageBadge,
  href,
  checked,
  focusRequested = false,
  onFocused,
}: CardThumbnailProps) {
  const focusTarget = useRef<HTMLElement | null>(null);
  const setFocusTarget = (node: HTMLElement | null) => {
    focusTarget.current = node;
  };
  const focused = useEffectEvent(() => onFocused?.());
  useLayoutEffect(() => {
    if (focusRequested) {
      focusTarget.current?.focus({ preventScroll: true });
      focused();
    }
  }, [focusRequested]);

  const findOtherSide = use(OtherSideContext);
  const [flip, setFlip] = useState<{ entryKey: string; flipped: boolean } | null>(null);
  const entryKey = sideKey(entry);
  const flipTarget =
    findOtherSide && showImages && otherSideInset && view === "printings" && checked === undefined
      ? findOtherSide(entry)
      : undefined;
  const flipped = flipTarget !== undefined && flip?.entryKey === entryKey && flip.flipped;
  const printing = flipped ? flipTarget : entry;
  const toggleFlip = () => setFlip({ entryKey, flipped: !flipped });

  const card = displayCard(printing);
  const displayName = printingName(printing, printing.card);
  const art = showImages ? tileArt(printing, display.getFallbackArt) : NO_TILE_ART;
  // Reads printing.card.types directly, not card.types: coupling this to the derived
  // `card` object would block React Compiler from memoizing it and its JSX.
  const orientation = getOrientation(printing.card.types);
  const thumbnailUrl = art.imageId === null ? null : imageUrl(art.imageId, "400w");
  const srcSet = art.imageId === null ? undefined : imageSrcSet(art.imageId);
  const fallbackArt = fallbackArtStep(printing, art.fallback);
  const rotated = needsCssRotation(orientation);

  const {
    fancyFan,
    gridFoil,
    coarsePointer,
    domainColors,
    finishLabels,
    sizeLabels,
    rarityLabels,
    prices,
    favoriteMarketplace,
  } = display;
  const favoritePrice = prices.get(printing.printingId, favoriteMarketplace);
  const isFoilCard = isFoilFinish(printing.finish);
  const finishTitle = enumLabel(finishLabels, printing.finish);
  const pairOtherSide = view === "cards" ? undefined : printing.otherSide;
  const insetSide =
    showImages && otherSideInset && view === "printings" ? printing.otherSide : undefined;
  const pairHint = view === "cards" ? doubleSidedHint(printing) : undefined;
  const rarityTitle = enumLabel(rarityLabels, printing.rarity);
  const isOversized = printing.size !== WellKnown.cardSize.STANDARD;
  const sizeLabel = enumLabel(sizeLabels, printing.size);
  const otherPrintings = siblings
    ? siblings.filter((s) => sideKey(s) !== sideKey(printing)).toReversed()
    : [];
  const fanStep = cardWidth === undefined ? 2 : Math.max(1, cardWidth * 0.01);
  const fanAngle = fancyFan ? 8 : 1.5;
  const [fanOpen, setFanOpen] = useState(false);
  const [fanSettled, setFanSettled] = useState(false);
  const fanReady = fanOpen && fanSettled;
  // Latches true on first hover and never resets, so re-entering doesn't remount sibling faces.
  const [fanHovered, setFanHovered] = useState(false);

  // Base-list bans apply to all constructed play; mode-scoped bans (e.g. 2v2-only)
  // leave the card legal elsewhere, so only base bans get the full "unusable" treatment.
  const legality = useViewerLegality();
  const viewerBans = cardBansFor(printing.card, legality);
  const setStatus = standardSetLegality(printing.card, legality);
  const activeBans = banDisplay === "none" ? [] : viewerBans.bans;
  const banDim = banDisplay === "overlay" &&
    activeBans.some((ban) => isBaseBanFormat(ban.formatId)) && (
      <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-black/70" />
    );

  const upcomingBans = banDisplay === "none" ? [] : viewerBans.upcomingBans;
  const rotatedOn =
    banDisplay !== "none" && setStatus.status === "rotated" ? setStatus.until : undefined;
  // Preview outranks an upcoming ban: the card is still legal, and the Riot TCG
  // community license requires previewed/unreleased cards to be labeled.
  // `setReleased` is per printing language, covering a set out elsewhere but not here.
  const ribbon =
    activeBans.length > 0 || printing.setReleased ? (
      <BanRibbon bans={activeBans} upcomingBans={upcomingBans} rotatedOn={rotatedOn} />
    ) : (
      <CornerRibbon tone="caution" title={m.cards_thumb_not_released()}>
        {m.cards_thumb_preview_ribbon()}
      </CornerRibbon>
    );

  const imageStack = (
    <>
      {otherPrintings.map((sibling, i) => {
        const depth = otherPrintings.length - i;
        const hiddenWhenClosed = depth > MAX_CLOSED_STACK_EDGES;
        const closedDepth = Math.min(depth, MAX_CLOSED_STACK_EDGES);
        // Defers the image download and placeholder DOM until first hover, and skips
        // them on coarse-pointer devices, where the fan never opens.
        const showSiblingFaces = fancyFan && !coarsePointer && fanHovered;
        const siblingArt =
          showImages && showSiblingFaces ? tileArt(sibling, display.getFallbackArt) : NO_TILE_ART;
        const siblingImageId = siblingArt.imageId;
        const siblingSizes = cardWidth ? `${Math.round(cardWidth - 12)}px` : sizesOverride;
        return (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative layer beside the card's own click target; keyboard nav handled by the grid
          <div
            key={sideKey(sibling)}
            className={cn(
              "pointer-events-none absolute inset-0",
              fanReady && "pointer-events-auto cursor-pointer",
              dimmed && "opacity-50",
            )}
            onClick={(e) => {
              e.stopPropagation();
              (onSiblingClick ?? onClick)(sibling);
            }}
          >
            {/* preserve-3d must sit on this element and overflow-hidden on a separate
                child below, or Firefox mis-sizes and clips the rotated overlay. */}
            <div
              className={cn(SHELL_INNER_CLASS, "origin-bottom")}
              style={{
                borderRadius: CARD_BORDER_RADIUS,
                transformStyle: "preserve-3d",
                translate: `calc((1 - var(--fan, 0)) * ${closedDepth * fanStep}px) calc((1 - var(--fan, 0)) * ${closedDepth * fanStep}px)`,
                rotate: `calc(var(--fan, 0) * ${depth * fanAngle}deg)`,
                opacity: hiddenWhenClosed ? "var(--fan, 0)" : undefined,
                transition:
                  "rotate 200ms ease-out, translate 200ms ease-out, scale 150ms ease-out, opacity 200ms ease-out",
              }}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && event.propertyName === "rotate") {
                  setFanSettled(fanOpen);
                }
              }}
            >
              <div
                className="aspect-card relative overflow-hidden bg-black"
                style={{ borderRadius: CARD_BORDER_RADIUS }}
              >
                {showSiblingFaces && (
                  <CardImageContent
                    thumbnailUrl={siblingImageId === null ? null : imageUrl(siblingImageId, "400w")}
                    srcSet={siblingImageId === null ? undefined : imageSrcSet(siblingImageId)}
                    sizes={siblingSizes}
                    alt=""
                    priority={false}
                    rotated={rotated}
                    rarity={sibling.rarity}
                    publicCode={sibling.publicCode}
                    artist={sibling.artist}
                    promoLabel={promoMarkerLabel(sibling)}
                    card={displayCard(sibling)}
                    showFoil={false}
                    fallbackArt={siblingFallbackArt(siblingArt.fallback)}
                  />
                )}
                {showSiblingFaces && (
                  // z-[1]: above the face, below the ::after border (z-10).
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[1] bg-black"
                    style={{
                      opacity: "calc(1 - var(--fan, 0))",
                      transition: "opacity 200ms ease-out",
                    }}
                  />
                )}
                {isFoilFinish(sibling.finish) && gridFoil && <FoilOverlay active dim />}
              </div>
            </div>
          </div>
        );
      })}
      <ImageShell badge={imageBadge} selected={selected}>
        <ImageTarget
          className={cn(
            "bg-muted aspect-card relative block w-full overflow-hidden",
            dimmed && "opacity-50",
          )}
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          ref={setFocusTarget}
          href={href}
          draggable={dragData ? false : undefined}
          onClick={(event) => onClick(printing, event)}
          checked={checked}
        >
          <CardImageContent
            thumbnailUrl={thumbnailUrl}
            srcSet={srcSet}
            sizes={cardWidth ? `${Math.round(cardWidth - 12)}px` : sizesOverride}
            alt={displayName}
            priority={Boolean(priority)}
            rotated={rotated}
            rarity={printing.rarity}
            publicCode={printing.publicCode}
            artist={printing.artist}
            promoLabel={promoMarkerLabel(printing)}
            card={card}
            showFoil={isFoilCard && gridFoil}
            fallbackArt={fallbackArt}
          />
        </ImageTarget>
        {insetSide && (
          <OtherSideInset
            otherSide={insetSide}
            showFoil={insetSide.finish === WellKnown.finish.FOIL && gridFoil}
            dimmed={dimmed}
            rotated={
              flipTarget !== undefined &&
              needsCssRotation(getOrientation((flipped ? entry : flipTarget).card.types))
            }
            onFlip={flipTarget ? toggleFlip : undefined}
          />
        )}
        {banDim}
        {ribbon}
        {imageOverlay}
      </ImageShell>
    </>
  );

  // The sibling layers are absolute against this box; without them the shell is
  // already the card box and the wrapper is dead weight.
  const imageSection =
    otherPrintings.length > 0 ? (
      <div className="relative group-hover:z-20">{imageStack}</div>
    ) : (
      imageStack
    );

  const priceNode =
    favoritePrice === undefined ? undefined : (
      <span className="flex shrink-0 items-center gap-1">
        <MarketplaceIcon marketplace={display.favoriteMarketplace} className="h-2.5 opacity-70" />
        {view === "cards" && priceRange && priceRange.min !== priceRange.max ? (
          <>
            {/* Below 12rem (phone 2-column grid) the full range leaves the name ~10 characters. */}
            <span className={cn("@[12rem]:hidden", priceColorClass(priceRange.min))}>
              {display.compactFmt(priceRange.min)}+
            </span>
            <span className="hidden items-center gap-0.5 @[12rem]:flex">
              <span className={priceColorClass(priceRange.min)}>
                {display.compactFmt(priceRange.min)}
              </span>
              <span className="text-muted-foreground/60">&ndash;</span>
              <span className={priceColorClass(priceRange.max)}>
                {display.compactFmt(priceRange.max)}
              </span>
            </span>
          </>
        ) : (
          <span className={priceColorClass(favoritePrice)}>
            {display.compactFmt(favoritePrice)}
          </span>
        )}
      </span>
    );

  const labelSection = (
    <CardMetaLabel
      className={cn("relative z-10", LABEL_WRAPPER_MT_CLASS)}
      shortCode={printing.shortCode}
      name={displayName}
      pair={
        pairOtherSide
          ? {
              side: printing.side,
              other: {
                shortCode: pairOtherSide.shortCode,
                name: otherSideName(pairOtherSide),
                finish: pairOtherSide.finish,
                finishTitle: pairOtherSide.finish
                  ? enumLabel(finishLabels, pairOtherSide.finish)
                  : undefined,
              },
            }
          : undefined
      }
      pairHint={pairHint}
      rarity={printing.rarity}
      rarityTitle={rarityTitle}
      finish={printing.finish}
      finishTitle={finishTitle}
      oversized={isOversized}
      sizeLabel={sizeLabel}
      bans={banDisplay === "label" ? viewerBans.bans : undefined}
      hasRulesDeviation={errataForLanguage(printing.card.errata, printing.language) !== null}
      printingComment={printing.comment}
      printingCount={
        otherPrintings.length > 0 ? groupPrintingDesigns(siblings ?? []).designs.length : undefined
      }
      price={priceNode}
    />
  );

  const flashOverlay = isFlashing && (
    <div
      className="pointer-events-none absolute inset-0 rounded-lg"
      style={{
        ...getDomainGradientStyle(card.domains, "C0", domainColors),
        animation: "selection-flash 800ms ease-out forwards",
      }}
      onAnimationEnd={() => useGridFocusStore.getState().setFlashCardId(null)}
    />
  );

  const fanMouseEnter =
    otherPrintings.length > 0
      ? () => {
          // Mounted immediately so images are requested before the fan-open
          // transition reveals anything behind the front card.
          setFanHovered(true);
          setFanOpen(true);
        }
      : undefined;

  const fanMouseLeave =
    otherPrintings.length > 0
      ? () => {
          setFanOpen(false);
          setFanSettled(false);
        }
      : undefined;

  const wrapperClassName = cn(
    "group relative z-0 w-full rounded-lg text-left hover:z-10",
    BUTTON_PAD_CLASS,
    otherPrintings.length > 0 && "hover:[--fan:1]",
    selected && "bg-primary/10",
  );
  const wrapperContent = (
    <>
      {flashOverlay}
      {/* Outside the image target: interactive `aboveCard` strips must not nest in a button or link. */}
      {aboveCard}
      {printing.images.length > 0 ? (
        imageSection
      ) : (
        <div className="relative">
          {imageSection}
          {/* Sibling of the image (not inside it) so the unowned opacity-50 dim
              on imageSection never greys the notice out. */}
          <SuggestImageNotice printing={printing} />
        </div>
      )}
      {labelSection}
      {belowLabel}
    </>
  );

  if (dragData) {
    return (
      <DraggableTileWrapper
        dragId={dragId ?? `card-${printing.printingId}`}
        dragData={dragData}
        blockedLabel={dragBlockedLabel}
        className={wrapperClassName}
        onMouseEnter={fanMouseEnter}
        onMouseLeave={fanMouseLeave}
        printingId={printing.printingId}
        tileSideKey={entryKey}
      >
        {wrapperContent}
      </DraggableTileWrapper>
    );
  }

  return (
    <div
      data-printing-id={printing.printingId}
      data-side-key={entryKey}
      className={wrapperClassName}
      onMouseEnter={fanMouseEnter}
      onMouseLeave={fanMouseLeave}
    >
      {wrapperContent}
    </div>
  );
});
