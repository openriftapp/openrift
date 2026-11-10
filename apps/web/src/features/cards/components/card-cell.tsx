import type { Printing } from "@openrift/shared/types/catalog";
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from "react";
import { cloneElement } from "react";

import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import type { CardRenderContext } from "@/lib/card-viewer-types";

export interface CardCellProps {
  printing: Printing;
  ctx: CardRenderContext;
  display: CardThumbnailDisplay;
  showImages: boolean;
  view?: "cards" | "printings";

  onClick: (printing: Printing, event?: ReactMouseEvent) => void;
  onSiblingClick?: (printing: Printing) => void;
  href?: string;

  strip?: ReactNode;

  siblings?: Printing[];
  priceRange?: { min: number; max: number };

  belowLabel?: ReactNode;
  imageOverlay?: ReactNode;
  imageBadge?: ReactNode;

  dimmed?: boolean;
  checked?: boolean;
  highlighted?: boolean;
  banDisplay?: "label" | "overlay" | "none";

  dragData?: Record<string, unknown>;
  dragId?: string;

  wrap?: ReactElement<{ children?: ReactNode }>;
  contextMenu?: ReactElement<{ children?: ReactNode }>;
}

export function CardCell({
  printing,
  ctx,
  display,
  showImages,
  view,
  onClick,
  onSiblingClick,
  href,
  strip,
  siblings,
  priceRange,
  belowLabel,
  imageOverlay,
  imageBadge,
  dimmed,
  checked,
  highlighted,
  banDisplay,
  dragData,
  dragId,
  wrap,
  contextMenu,
}: CardCellProps) {
  const thumbnail = (
    <CardThumbnail
      printing={printing}
      onClick={onClick}
      onSiblingClick={onSiblingClick}
      showImages={showImages}
      selected={ctx.isSelected === true || highlighted === true}
      isFlashing={ctx.isFlashing}
      cardWidth={ctx.cardWidth}
      priority={ctx.priority}
      display={display}
      view={view}
      siblings={siblings}
      priceRange={priceRange}
      dimmed={dimmed}
      checked={checked}
      banDisplay={banDisplay}
      belowLabel={belowLabel}
      imageOverlay={imageOverlay}
      imageBadge={imageBadge}
      dragData={dragData}
      dragId={dragId}
      aboveCard={strip}
      href={href}
    />
  );

  let content: ReactNode = thumbnail;
  if (contextMenu) {
    content = cloneElement(contextMenu, undefined, content);
  }
  if (wrap) {
    content = cloneElement(wrap, undefined, content);
  }
  return content;
}
