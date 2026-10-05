import { useDraggable } from "@dnd-kit/core";
import type {
  BoardArrow,
  BoardCardRef,
  BoardPlayer,
  BoardZoneRef,
} from "@openrift/shared/board-state";
import { imageUrl } from "@openrift/shared/image-url";

import { CardIcon } from "@/components/card-icon";
import {
  CARD_CORNER_STYLE,
  CARD_TURNED,
  CARD_UPRIGHT,
  LANDSCAPE_CORNER_STYLE,
  PLAYER_COLOR,
  zoneEdge,
} from "@/features/board-states/lib/board-style";
import { frontImageId } from "@/features/cards/lib/card-meta";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface PieceDragData {
  type: "board-piece";
  pieceId: string;
}

export interface ArrowDragData {
  type: "board-arrow";
  from: BoardArrow["from"];
}

export interface PieceDropData {
  type: "board-piece-target";
  pieceId: string;
}

export interface ChainDropData {
  type: "board-chain-target";
  entryId: string;
}

export interface ZoneDropData {
  type: "board-zone";
  zone: BoardZoneRef;
  owner?: BoardPlayer;
}

export function cardImageId(card: BoardCardRef, catalog: UseCardsResult): string | undefined {
  const preferred = card.printingId ? catalog.printingsById[card.printingId] : undefined;
  const printing =
    preferred && frontImageId(preferred) !== null
      ? preferred
      : catalog.printingsByCardId
          .get(card.cardId)
          ?.find((candidate) => frontImageId(candidate) !== null);
  return frontImageId(printing) ?? undefined;
}

export function cardImage(card: BoardCardRef, catalog: UseCardsResult): string | undefined {
  const id = cardImageId(card, catalog);
  return id === undefined ? undefined : imageUrl(id, "240w");
}

export function CardBack({ owner, className }: { owner: BoardPlayer; className?: string }) {
  return (
    <span
      className={cn(
        "bg-board-felt-edge relative block min-w-0 overflow-hidden border",
        CARD_UPRIGHT,
        className,
      )}
      style={{ ...CARD_CORNER_STYLE, borderColor: zoneEdge(owner) }}
    >
      <CardIcon src="/logo.svg" className="absolute inset-0 m-auto size-10 text-white opacity-40" />
    </span>
  );
}

export const CARD_SLOT_CLASS = cn(
  "flex shrink-0 items-center justify-center border border-dashed border-white/40 text-white/70 hover:border-white/80 hover:bg-white/10 hover:text-white",
  CARD_UPRIGHT,
);

export const BOARD_ADD_SLOT_CLASS = cn(
  "flex shrink-0 items-center justify-center border border-dashed border-transparent bg-white/5 text-white/50 hover:border-white/60 hover:bg-white/10 hover:text-white",
  CARD_UPRIGHT,
);

/** A non-interactive mini card for drag previews: the same face as a piece, no marks. */
export function CardGhost({
  name,
  image,
  owner,
}: {
  name: string;
  image?: string;
  owner: BoardPlayer;
}) {
  return (
    <span
      className={cn(
        "bg-card relative block overflow-hidden border shadow-xl",
        CARD_UPRIGHT,
        image === undefined ? "border-2 border-dashed" : "border-card-edge",
      )}
      style={{
        ...CARD_CORNER_STYLE,
        borderColor: image === undefined ? PLAYER_COLOR[owner] : undefined,
      }}
    >
      {image === undefined ? (
        <span className="font-card text-card-foreground flex size-full items-center justify-center p-1 text-center text-xs leading-tight">
          {name}
        </span>
      ) : (
        <img src={image} alt="" aria-hidden className="size-full object-cover" />
      )}
    </span>
  );
}

export function BattlefieldCardFrame({
  index,
  cardName,
  image,
}: {
  index: number;
  cardName: string | null;
  image?: string;
}) {
  const blank = image === undefined && cardName === null;
  return (
    <span
      className={cn(
        "relative flex min-w-0 items-center justify-center overflow-hidden border px-2 text-center",
        blank
          ? "border-white/25 bg-black/30 text-white/60"
          : "border-card-edge bg-white/90 text-black shadow-md",
        CARD_TURNED,
      )}
      style={LANDSCAPE_CORNER_STYLE}
    >
      {image === undefined ? (
        <span className={cn("leading-tight", blank ? "text-xs" : "font-card font-semibold")}>
          {cardName ?? m.board_states_battlefield({ number: index + 1 })}
        </span>
      ) : (
        <img src={image} alt={cardName ?? ""} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

export function ArrowHandle({ from }: { from: BoardArrow["from"] }) {
  const data: ArrowDragData = { type: "board-arrow", from };
  const id = "piece" in from ? `arrow:${from.piece}` : `arrow:chain:${from.chain}`;
  const { setNodeRef, listeners, attributes } = useDraggable({ id, data });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={m.board_states_arrow_handle()}
      className="bg-gilt absolute top-1/2 -right-1.5 z-10 size-3 -translate-y-1/2 cursor-grab rounded-full ring-1 ring-black/50"
    />
  );
}

export function KeywordBadgeChip({
  keyword,
  badge,
}: {
  keyword: string;
  badge?: { color: string; darkText: boolean; label: string };
}) {
  return (
    <span className="relative inline-flex items-center pr-1.5 pl-1">
      <span
        className="absolute inset-0 -skew-x-[15deg]"
        style={{ backgroundColor: badge?.color ?? "#707070" }}
      />
      <span
        className={cn(
          "font-condensed text-2xs relative font-semibold tracking-tighter uppercase italic",
          badge?.darkText ? "text-black" : "text-white",
        )}
      >
        {badge?.label ?? keyword}
      </span>
    </span>
  );
}
