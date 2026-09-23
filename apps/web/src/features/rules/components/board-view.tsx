import { useDraggable, useDroppable } from "@dnd-kit/core";
import type {
  BoardArrow,
  BoardCardRef,
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import { imageUrl } from "@openrift/shared/image-url";
import { DropletIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useRef } from "react";

import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Pressable } from "@/components/ui/pressable";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { frontImageId } from "@/features/cards/lib/card-meta";
import type { UseCardsResult } from "@/features/cards/lib/catalog-query";
import { ArrowOverlay, pieceLayoutSignature } from "@/features/rules/components/board-arrows";
import type { SeatSlot } from "@/features/rules/lib/board-layout";
import {
  arrowZoneKey,
  pieceNumerals,
  piecesAt,
  seatSlots,
  seatsFor,
  slotKey,
  zoneAcceptsMore,
} from "@/features/rules/lib/board-layout";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCardModifierKeywords, useKeywordStyles } from "@/hooks/use-keyword-styles";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export const PLAYER_COLOR: Record<BoardPlayer, string> = {
  A: "oklch(0.55 0.08 195)",
  B: "oklch(0.6 0.1 75)",
  C: "oklch(0.55 0.1 330)",
  D: "oklch(0.55 0.1 140)",
};

const UNKNOWN_KEYWORD = { color: "#707070", darkText: false };

const ZONE_LABEL: Record<PlayerZoneKind, () => string> = {
  base: m.board_states_zone_base,
  legend: m.board_states_zone_legend,
  champion: m.board_states_zone_champion,
  runes: m.board_states_zone_runes,
  hand: m.board_states_zone_hand,
  trash: m.board_states_zone_trash,
};

const STACK_LABEL = {
  runeDeck: m.board_states_zone_rune_deck,
  deck: m.board_states_zone_main_deck,
} as const;

/** Card frame, upright and on its side; the outer box keeps the rotated footprint. */
const CARD_UPRIGHT = "h-[7.7rem] w-22 sm:h-[9.8rem] sm:w-28";
const CARD_TURNED = "h-22 w-[7.7rem] sm:h-28 sm:w-[9.8rem]";
/** The card browser's corner radius, so every mini card rounds in scale with its size. */
export const CARD_CORNER_STYLE = { borderRadius: CARD_BORDER_RADIUS } as const;
/** The same radius on a card lying sideways (battlefields). */
export const LANDSCAPE_CORNER_STYLE = { borderRadius: "3.6% / 5%" } as const;

/** Zone edges read as chalk on felt, tinted towards the seat's colour. */
function zoneEdge(owner: BoardPlayer): string {
  return `color-mix(in oklab, ${PLAYER_COLOR[owner]} 45%, oklch(1 0 0 / 0.5))`;
}

interface BoardInteraction {
  selectedPieceId?: string | null;
  selectedPieceIds?: readonly string[];
  highlightedPieceId?: string | null;
  pieceNumerals?: boolean;
  onPieceClick?: (piece: BoardPiece, event: React.MouseEvent) => void;
  onPieceContextMenu?: (piece: BoardPiece, event: React.MouseEvent) => void;
  onZoneClick?: (zone: BoardZoneRef, owner: BoardPlayer) => void;
  /** A card is armed for placement: every zone invites a click. */
  zonesArmed?: boolean;
  /** Requires a surrounding `DndContext`. */
  draggable?: boolean;
  /** Renders an arrow-drag handle on the selected piece. Requires a surrounding `DndContext`. */
  arrowHandle?: boolean;
  renderZoneAdd?: (zone: BoardZoneRef, owner: BoardPlayer) => ReactNode;
  renderChainAdd?: () => ReactNode;
  onChainEntryRemove?: (index: number) => void;
  renderBattlefieldCard?: (index: number, cardName: string | null, image?: string) => ReactNode;
  renderPieceOverlay?: (piece: BoardPiece) => ReactNode;
}

export interface PieceDragData {
  type: "board-piece";
  pieceId: string;
}

export interface ArrowDragData {
  type: "board-arrow";
  from: string;
}

export interface PieceDropData {
  type: "board-piece-target";
  pieceId: string;
}

export interface ZoneDropData {
  type: "board-zone";
  zone: BoardZoneRef;
  owner: BoardPlayer;
}

interface KeywordBadge {
  color: string;
  darkText: boolean;
  label: string;
}

interface BoardArt {
  pieceImages: Map<string, string>;
  chainImages: Map<number, string>;
  battlefieldImages: Map<number, string>;
  keywords: Map<string, KeywordBadge>;
}

const PLAIN_ART: BoardArt = {
  pieceImages: new Map(),
  chainImages: new Map(),
  battlefieldImages: new Map(),
  keywords: new Map(),
};

interface BoardViewProps extends BoardInteraction {
  document: BoardDocument;
  step: BoardStep;
  className?: string;
}

/**
 * The catalogue and keyword styles are client-only here: the share page does
 * not load them, and pulling them in during SSR would double its payload.
 */
export function BoardView(props: BoardViewProps) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <BoardTable {...props} art={PLAIN_ART} />;
  }
  return (
    <Suspense fallback={<BoardTable {...props} art={PLAIN_ART} />}>
      <BoardTableWithArt {...props} />
    </Suspense>
  );
}

export function cardImage(card: BoardCardRef, catalog: UseCardsResult): string | undefined {
  const preferred = card.printingId ? catalog.printingsById[card.printingId] : undefined;
  const printing =
    preferred && frontImageId(preferred) !== null
      ? preferred
      : catalog.printingsByCardId
          .get(card.cardId)
          ?.find((candidate) => frontImageId(candidate) !== null);
  const id = frontImageId(printing);
  return id === null ? undefined : imageUrl(id, "240w");
}

function BoardTableWithArt(props: BoardViewProps) {
  const catalog = useCards();
  const styles = useKeywordStyles();
  const modifiers = useCardModifierKeywords();
  const locale = getLocale();

  const pieceImages = new Map<string, string>();
  for (const piece of props.step.pieces) {
    const url = piece.card ? cardImage(piece.card, catalog) : undefined;
    if (url !== undefined) {
      pieceImages.set(piece.id, url);
    }
  }
  const chainImages = new Map<number, string>();
  for (const [index, entry] of props.step.chain.entries()) {
    const url = cardImage(entry.card, catalog);
    if (url !== undefined) {
      chainImages.set(index, url);
    }
  }
  const battlefieldImages = new Map<number, string>();
  for (const [index, battlefield] of props.document.battlefields.entries()) {
    const url = battlefield.card ? cardImage(battlefield.card, catalog) : undefined;
    if (url !== undefined) {
      battlefieldImages.set(index, url);
    }
  }
  const keywords = new Map<string, KeywordBadge>();
  for (const piece of props.step.pieces) {
    for (const keyword of piece.keywords) {
      const base = keyword.replace(/\s+\d+$/u, "");
      const style = modifiers.find((entry) => entry.name === base) ?? UNKNOWN_KEYWORD;
      const translated = styles[base]?.translations?.[locale];
      keywords.set(keyword, {
        color: style.color,
        darkText: style.darkText,
        label: translated === undefined ? keyword : keyword.replace(base, translated),
      });
    }
  }
  return <BoardTable {...props} art={{ pieceImages, chainImages, battlefieldImages, keywords }} />;
}

interface BoardTableProps extends BoardViewProps {
  art: BoardArt;
}

function BoardTable({ document, step, className, art, ...interaction }: BoardTableProps) {
  const seats = seatsFor(document.playerCount);
  const slots = seatSlots(document.zones);
  const numerals = interaction.pieceNumerals === false ? new Map() : pieceNumerals(step.pieces);
  const containerRef = useRef<HTMLDivElement>(null);
  const context: BoardContext = {
    step,
    art,
    numerals,
    interaction,
    zones: document.zones,
    seatMarksOnBattlefields: slots.length === 0,
  };
  return (
    <div
      className={cn(
        "bg-board-felt border-board-felt-edge overflow-x-auto rounded-lg border-2 p-2 text-white sm:p-3",
        className,
      )}
    >
      <div className="flex min-w-0 gap-2 sm:gap-3">
        <div ref={containerRef} className="relative flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
          {document.zones.chain && <ChainRow context={context} />}
          <SeatSide players={seats.top} slots={slots} top context={context} />
          <BattlefieldRow battlefields={document.battlefields} seats={seats} context={context} />
          <SeatSide players={seats.bottom} slots={slots} context={context} />
          <ArrowOverlay
            key={`${document.playerCount}:${document.battlefields.length}:${Object.values(document.zones).join(",")}:${pieceLayoutSignature(step.pieces)}`}
            containerRef={containerRef}
            arrows={step.arrows}
          />
        </div>
      </div>
    </div>
  );
}

interface BoardContext {
  step: BoardStep;
  /** No seat zones are shown, so the seat letters move onto the battlefield halves. */
  seatMarksOnBattlefields: boolean;
  art: BoardArt;
  numerals: Map<string, number>;
  interaction: BoardInteraction;
  zones: BoardDocument["zones"];
}

function SeatSide({
  players,
  slots,
  top,
  context,
}: {
  players: BoardPlayer[];
  slots: SeatSlot[];
  /** The far seat: its hand strip sits at the table edge, above the zones. */
  top?: boolean;
  context: BoardContext;
}) {
  if (players.length === 0 || (slots.length === 0 && !context.zones.hand)) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="grid gap-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}
      >
        {players.map((player) => (
          <div
            key={player}
            className={cn("flex min-w-0 gap-1.5", top ? "flex-col-reverse" : "flex-col")}
          >
            {slots.length > 0 && (
              <div className="relative flex min-w-0 flex-wrap items-stretch gap-1.5">
                <SeatMark player={player} />

                {slots.map((slot) => (
                  <SeatSlotCell key={slotKey(slot)} slot={slot} owner={player} context={context} />
                ))}
              </div>
            )}
            {context.zones.hand && <HandStrip owner={player} context={context} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The seat's letter, faint and large, behind its zones. */
function SeatMark({ player }: { player: BoardPlayer }) {
  return (
    <span
      aria-hidden
      className="font-heading pointer-events-none absolute inset-0 flex items-center justify-end pr-4 text-7xl font-bold select-none"
      style={{ color: PLAYER_COLOR[player], opacity: 0.4 }}
    >
      {player}
    </span>
  );
}

function SeatSlotCell({
  slot,
  owner,
  mirrored,
  context,
}: {
  slot: SeatSlot;
  owner: BoardPlayer;
  mirrored?: boolean;
  context: BoardContext;
}) {
  if (slot.kind === "stack") {
    return <DeckStack stack={slot.stack} owner={owner} mirrored={mirrored} />;
  }
  return <PlayerZone kind={slot.zone} owner={owner} mirrored={mirrored} context={context} />;
}

function DeckStack({
  stack,
  owner,
  mirrored,
}: {
  stack: "runeDeck" | "deck";
  owner: BoardPlayer;
  mirrored?: boolean;
}) {
  return (
    <div className={cn("flex shrink-0 gap-1", mirrored ? "flex-row-reverse" : "flex-row")}>
      <ZoneLabel text={STACK_LABEL[stack]()} mirrored={mirrored} />
      <div
        className={cn("bg-board-felt-edge relative min-w-0 overflow-hidden border", CARD_UPRIGHT)}
        style={{ ...CARD_CORNER_STYLE, borderColor: zoneEdge(owner) }}
      >
        <img
          src="/logo.svg"
          alt=""
          aria-hidden
          className="absolute inset-0 m-auto size-10 opacity-40 brightness-0 invert"
        />
      </div>
    </div>
  );
}

function ZoneLabel({ text, mirrored }: { text: string; mirrored?: boolean }) {
  return (
    <span
      className={cn(
        "text-2xs shrink-0 self-stretch truncate text-white/50 uppercase [writing-mode:vertical-rl]",
        mirrored ? "text-left" : "rotate-180 text-left",
      )}
    >
      {text}
    </span>
  );
}

interface ZoneFrameProps {
  zone: BoardZoneRef;
  owner: BoardPlayer;
  interaction: BoardInteraction;
  /** The seat is rotated 180°, so the label and the add button are turned back to read upright. */
  mirrored?: boolean;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

function ZoneFrame(props: ZoneFrameProps) {
  const frame = props.interaction.draggable ? (
    <DroppableZoneFrame {...props} />
  ) : (
    <ZoneFrameBody {...props} className={cn(props.className, "flex-1")} />
  );
  return frame;
}

/** Dashed card-sized slot the editor renders as its "add here" trigger. */
export const CARD_SLOT_CLASS = cn(
  "flex shrink-0 items-center justify-center border border-dashed border-white/40 text-white/70 hover:border-white/80 hover:bg-white/10 hover:text-white",
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

function DroppableZoneFrame(props: ZoneFrameProps) {
  const data: ZoneDropData = { type: "board-zone", zone: props.zone, owner: props.owner };
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${arrowZoneKey(props.zone, props.owner)}`,
    data,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0",
        props.fill && "flex-1",
        isOver && "ring-ring rounded-md ring-2",
      )}
    >
      <ZoneFrameBody {...props} className={cn(props.className, "flex-1")} />
    </div>
  );
}

function ZoneFrameBody({
  zone,
  owner,
  interaction,
  mirrored,
  className,
  style,
  children,
}: ZoneFrameProps) {
  const classes = cn(
    "flex min-w-0 gap-1 rounded-md p-1 text-left",
    mirrored ? "flex-row-reverse" : "flex-row",
    className,
  );
  const zoneKey = arrowZoneKey(zone, owner);
  if (!interaction.onZoneClick) {
    return (
      <div className={classes} style={style} data-board-zone={zoneKey}>
        {children}
      </div>
    );
  }
  const { onZoneClick } = interaction;
  // The zone holds the piece and add-slot buttons, so it cannot be a button itself;
  // the add slot is the keyboard route into the zone.
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- wraps its own buttons
    <div
      className={cn(
        classes,
        "cursor-pointer hover:ring-2 hover:ring-white/60",
        interaction.zonesArmed && "ring-gilt/70 hover:ring-gilt ring-2",
      )}
      style={style}
      data-board-zone={zoneKey}
      onClick={() => onZoneClick(zone, owner)}
    >
      {children}
    </div>
  );
}

function PlayerZone({
  kind,
  owner,
  mirrored,
  context,
}: {
  kind: PlayerZoneKind;
  owner: BoardPlayer;
  mirrored?: boolean;
  context: BoardContext;
}) {
  const zone: BoardZoneRef = { kind };
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={context.interaction}
      mirrored={mirrored}
      fill={kind === "base"}
      className={cn(
        "min-h-[9rem] border border-dashed sm:min-h-[11.2rem]",
        kind === "base" && "min-w-80",
        kind === "runes" && "min-w-[13rem] sm:min-w-[16rem]",
        kind !== "base" && kind !== "runes" && "w-auto min-w-[7.2rem] sm:min-w-[8.8rem]",
      )}
      style={{ borderColor: zoneEdge(owner) }}
    >
      <ZoneLabel text={ZONE_LABEL[kind]()} mirrored={mirrored} />
      <PieceRow
        pieces={piecesAt(context.step, zone, owner)}
        mirrored={mirrored}
        context={context}
        trailing={
          zoneAcceptsMore(zone, piecesAt(context.step, zone, owner).length)
            ? context.interaction.renderZoneAdd?.(zone, owner)
            : undefined
        }
        overlap={kind === "runes"}
      />
    </ZoneFrame>
  );
}

function HandStrip({
  owner,
  mirrored,
  context,
}: {
  owner: BoardPlayer;
  mirrored?: boolean;
  context: BoardContext;
}) {
  const zone: BoardZoneRef = { kind: "hand" };
  const pieces = piecesAt(context.step, zone, owner);
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={context.interaction}
      mirrored={mirrored}
      fill
      className="min-h-[8rem] items-center border border-dashed"
      style={{ borderColor: zoneEdge(owner) }}
    >
      <ZoneLabel text={ZONE_LABEL.hand()} mirrored={mirrored} />
      <div className="flex min-h-0 flex-1 flex-wrap items-end justify-center">
        {pieces.map((piece, index) => (
          <span
            key={piece.id}
            className={cn("shrink-0", index > 0 && "-ml-4 sm:-ml-6")}
            style={{ rotate: `${(index - (pieces.length - 1) / 2) * 5}deg` }}
          >
            <Piece piece={piece} mirrored={mirrored} context={context} />
          </span>
        ))}
        {context.interaction.renderZoneAdd?.(zone, owner)}
      </div>
    </ZoneFrame>
  );
}

function BattlefieldRow({
  battlefields,
  seats,
  context,
}: {
  battlefields: BoardDocument["battlefields"];
  seats: ReturnType<typeof seatsFor>;
  context: BoardContext;
}) {
  if (battlefields.length === 0) {
    return null;
  }
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:[grid-template-columns:var(--battlefield-cols)] sm:gap-3"
      style={
        {
          "--battlefield-cols": `repeat(${battlefields.length}, minmax(0, 1fr))`,
        } as React.CSSProperties
      }
    >
      {battlefields.map((battlefield, index) => (
        <BattlefieldColumn
          // oxlint-disable-next-line react/no-array-index-key -- battlefields are positional
          key={index}
          index={index}
          cardName={battlefield.card?.name ?? null}
          seats={seats}
          context={context}
        />
      ))}
    </div>
  );
}

function BattlefieldColumn({
  index,
  cardName,
  seats,
  context,
}: {
  index: number;
  cardName: string | null;
  seats: ReturnType<typeof seatsFor>;
  context: BoardContext;
}) {
  const zone: BoardZoneRef = { kind: "battlefield", index };
  const image = context.art.battlefieldImages.get(index);
  const half = (players: BoardPlayer[]) => (
    <div
      className="grid h-[9rem] gap-1.5 sm:h-[11.2rem]"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, players.length)}, minmax(0, 1fr))` }}
    >
      {players.map((player) => (
        <ZoneFrame
          key={player}
          zone={zone}
          owner={player}
          interaction={context.interaction}
          fill
          className="relative items-center justify-center border border-dashed"
          style={{ borderColor: zoneEdge(player) }}
        >
          {context.seatMarksOnBattlefields && <SeatMark player={player} />}
          <PieceRow
            pieces={piecesAt(context.step, zone, player)}
            context={context}
            trailing={context.interaction.renderZoneAdd?.(zone, player)}
          />
        </ZoneFrame>
      ))}
    </div>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-black/25 p-1.5 ring-1 ring-white/10">
      {half(seats.top)}
      <div className="flex justify-center">
        {context.interaction.renderBattlefieldCard ? (
          context.interaction.renderBattlefieldCard(index, cardName, image)
        ) : (
          <BattlefieldCardFrame index={index} cardName={cardName} image={image} />
        )}
      </div>
      {half(seats.bottom)}
    </div>
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
  return (
    <span
      className={cn(
        "border-card-edge relative flex min-w-0 items-center justify-center overflow-hidden border bg-white/90 px-2 text-center shadow-md",
        CARD_TURNED,
      )}
      style={LANDSCAPE_CORNER_STYLE}
    >
      {image === undefined ? (
        <span
          className={cn(
            "font-card leading-tight font-semibold",
            cardName === null ? "text-black/50" : "text-black",
          )}
        >
          {cardName ?? m.board_states_battlefield({ number: index + 1 })}
        </span>
      ) : (
        <img src={image} alt={cardName ?? ""} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/** Pulls a stacked card over the previous one so the same strip of it stays visible, upright or turned. */
function overlapMargin(previousTurned: boolean): string {
  return previousTurned ? "-ml-[5.9rem] sm:-ml-[7.6rem]" : "-ml-[3.7rem] sm:-ml-[4.8rem]";
}

function PieceRow({
  pieces,
  mirrored,
  context,
  trailing,
  overlap,
}: {
  pieces: BoardPiece[];
  mirrored?: boolean;
  context: BoardContext;
  trailing?: ReactNode;
  /** Stack the cards like a rune pool, each one peeking out from under the next. */
  overlap?: boolean;
}) {
  if (pieces.length === 0 && !trailing) {
    return null;
  }
  return (
    <div className={cn("flex flex-wrap items-end", overlap ? "gap-y-1.5" : "gap-1.5")}>
      {pieces.map((piece, index) => (
        <span
          key={piece.id}
          className={cn(
            "shrink-0",
            overlap && index > 0 && overlapMargin(pieces[index - 1]?.exhausted === true),
          )}
          style={overlap ? { zIndex: index } : undefined}
        >
          <Piece piece={piece} mirrored={mirrored} context={context} />
        </span>
      ))}
      {trailing !== undefined && trailing !== null && (
        <span className={cn("shrink-0", overlap && pieces.length > 0 && "ml-1.5")}>{trailing}</span>
      )}
    </div>
  );
}

const PIECE_KIND_LABEL = {
  unit: m.board_states_piece_unit,
  spell: m.board_states_piece_spell,
  gear: m.board_states_piece_gear,
  rune: m.board_states_piece_rune,
  legend: m.board_states_piece_legend,
  token: m.board_states_piece_token,
} as const;

export function pieceName(piece: BoardPiece): string {
  return piece.card?.name ?? PIECE_KIND_LABEL[piece.kind]();
}

interface PieceProps {
  piece: BoardPiece;
  /** The seat faces the viewer from across the table, so its subtree is rotated. */
  mirrored?: boolean;
  context: BoardContext;
}

function Piece({ piece, mirrored, context }: PieceProps) {
  return context.interaction.draggable ? (
    <DraggablePiece piece={piece} mirrored={mirrored} context={context} />
  ) : (
    <PieceToken piece={piece} mirrored={mirrored} context={context} />
  );
}

function DraggablePiece({ piece, mirrored, context }: PieceProps) {
  const dragData: PieceDragData = { type: "board-piece", pieceId: piece.id };
  const dropData: PieceDropData = { type: "board-piece-target", pieceId: piece.id };
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `piece:${piece.id}`,
    data: dragData,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `target:${piece.id}`,
    data: dropData,
  });
  return (
    <div ref={setDropRef} className={cn(isOver && "ring-ring ring-2")} style={CARD_CORNER_STYLE}>
      <div
        ref={setDragRef}
        {...listeners}
        {...attributes}
        style={isDragging ? { opacity: 0.4 } : undefined}
      >
        <PieceToken piece={piece} mirrored={mirrored} context={context} />
      </div>
    </div>
  );
}

function ArrowHandle({ pieceId }: { pieceId: string }) {
  const data: ArrowDragData = { type: "board-arrow", from: pieceId };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `arrow:${pieceId}`, data });
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

function PieceToken({ piece, mirrored, context }: PieceProps) {
  const { interaction } = context;
  const selected =
    interaction.selectedPieceId === piece.id ||
    (interaction.selectedPieceIds?.includes(piece.id) ?? false);
  const spotlit = interaction.highlightedPieceId === piece.id;
  const glow = piece.highlight || spotlit;
  const numeral = context.numerals.get(piece.id);
  const image = context.art.pieceImages.get(piece.id);
  // Chips and badges are the author's marks, not print on the card, so they
  // stay upright however the card itself is turned.
  const marksRotation = (piece.exhausted ? 90 : 0) + (mirrored === true ? 180 : 0);
  const handle = interaction.arrowHandle === true && selected;
  const overlay = interaction.renderPieceOverlay?.(piece);
  const face = (
    <span
      className={cn(
        "bg-card absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border",
        CARD_UPRIGHT,
        piece.exhausted && "-rotate-90",
        piece.card === null ? "border-2 border-dashed" : "border-card-edge",
        glow && "ring-gilt ring-2 ring-offset-2 ring-offset-transparent",
        selected && !glow && "ring-ring ring-2 ring-offset-2 ring-offset-transparent",
      )}
      style={{
        ...CARD_CORNER_STYLE,
        borderColor: piece.card === null ? PLAYER_COLOR[piece.owner] : undefined,
        boxShadow: glow ? "0 0 10px color-mix(in oklab, var(--gilt) 70%, transparent)" : undefined,
      }}
    >
      <span className="absolute inset-0 min-w-0 overflow-hidden rounded-[inherit]">
        {image === undefined ? (
          <span className="font-card text-card-foreground flex size-full items-center justify-center p-1 text-center text-xs leading-tight">
            {pieceName(piece)}
          </span>
        ) : (
          <img src={image} alt="" aria-hidden className="size-full object-cover" />
        )}
      </span>
      <span
        className="pointer-events-none absolute inset-0"
        style={marksRotation === 0 ? undefined : { rotate: `${marksRotation}deg` }}
      >
        {piece.might !== 0 && (
          <span
            className={cn(
              "text-2xs absolute -top-1 -left-1 flex items-center gap-px rounded-full px-1 font-semibold",
              piece.might > 0
                ? "bg-success text-success-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <img
              src="/images/might.svg"
              alt=""
              aria-hidden
              className="size-2 brightness-0 invert"
            />
            {piece.card === null && piece.might > 0
              ? piece.might
              : piece.might > 0
                ? `+${piece.might}`
                : `−${Math.abs(piece.might)}`}
          </span>
        )}
        {piece.damage > 0 && (
          <span className="bg-destructive text-destructive-foreground text-2xs absolute -top-1 -right-1 flex items-center gap-px rounded-full px-1 font-semibold">
            <DropletIcon className="size-2" aria-hidden />
            {piece.damage}
          </span>
        )}
        {numeral !== undefined && (
          <span className="bg-gilt text-2xs absolute -bottom-1 -left-1 flex size-3.5 items-center justify-center rounded-full font-semibold text-black">
            {numeral}
          </span>
        )}
        {(piece.keywords.length > 0 || piece.label !== undefined) && (
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 flex-col items-center gap-px">
            {piece.keywords.map((keyword) => (
              <KeywordBadgeChip key={keyword} keyword={keyword} art={context.art} />
            ))}
            {piece.label !== undefined && (
              <span className="text-2xs rounded-sm bg-black/80 px-1 whitespace-nowrap text-white">
                {piece.label}
              </span>
            )}
          </span>
        )}
      </span>
    </span>
  );
  const box = (
    <span
      data-board-piece={piece.id}
      className={cn(
        "relative block shrink-0 transition-transform",
        piece.exhausted ? CARD_TURNED : CARD_UPRIGHT,
        spotlit && "scale-105",
      )}
      title={pieceName(piece)}
    >
      {face}
      {(handle || overlay !== undefined) && (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 [&>*]:pointer-events-auto",
            mirrored === true && "rotate-180",
          )}
        >
          {handle && <ArrowHandle pieceId={piece.id} />}
          {overlay}
        </span>
      )}
    </span>
  );
  const { onPieceClick, onPieceContextMenu } = interaction;
  if (!onPieceClick && !onPieceContextMenu) {
    return box;
  }
  return (
    <Pressable
      className="block"
      style={CARD_CORNER_STYLE}
      onClick={(event) => {
        event.stopPropagation();
        onPieceClick?.(piece, event);
      }}
      onContextMenu={(event) => onPieceContextMenu?.(piece, event)}
      aria-label={pieceName(piece)}
    >
      {box}
    </Pressable>
  );
}

function KeywordBadgeChip({ keyword, art }: { keyword: string; art: BoardArt }) {
  const badge = art.keywords.get(keyword);
  return (
    <span className="relative inline-flex items-center pr-1.5 pl-1">
      <span
        className="absolute inset-0 -skew-x-[15deg]"
        style={{ backgroundColor: badge?.color ?? UNKNOWN_KEYWORD.color }}
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

function ChainRow({ context }: { context: BoardContext }) {
  const { step, art, interaction } = context;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-black/25 p-1.5 ring-1 ring-white/10">
      <span className="text-2xs text-white/50 uppercase">
        {m.board_states_chain()} · {m.board_states_chain_order()}
      </span>
      <div className="flex flex-wrap items-end gap-1.5">
        {step.chain.map((entry, index) => (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- chain entries are positional
            key={index}
            className={cn("bg-card border-card-edge relative overflow-hidden border", CARD_UPRIGHT)}
            style={CARD_CORNER_STYLE}
            title={entry.card.name}
          >
            {art.chainImages.has(index) ? (
              <img src={art.chainImages.get(index)} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-card text-card-foreground flex size-full items-center justify-center p-1 text-center text-xs leading-tight">
                {entry.card.name}
              </span>
            )}
            <span
              className="text-2xs absolute right-0.5 bottom-0 font-semibold"
              style={{
                color: PLAYER_COLOR[entry.owner],
                textShadow: "0 1px 2px rgb(0 0 0 / 0.85)",
              }}
            >
              {entry.owner}
            </span>
            {interaction.onChainEntryRemove && (
              <span className="absolute top-0.5 left-0.5 rounded-full bg-black/70 text-white">
                <ChipRemoveButton
                  aria-label={m.board_states_editor_remove_chain()}
                  className="ml-0 flex size-4 items-center justify-center"
                  onClick={() => interaction.onChainEntryRemove?.(index)}
                />
              </span>
            )}
          </span>
        ))}
        {interaction.renderChainAdd?.()}
      </div>
    </div>
  );
}

export function describeZone(zone: BoardZoneRef, owner?: BoardPlayer): string {
  if (zone.kind === "battlefield") {
    return m.board_states_battlefield({ number: zone.index + 1 });
  }
  return owner ? `${ZONE_LABEL[zone.kind]()} ${owner}` : ZONE_LABEL[zone.kind]();
}

export function describeArrow(arrow: BoardArrow, step: BoardStep): string {
  const nameOf = (id: string) => {
    const piece = step.pieces.find((candidate) => candidate.id === id);
    return piece ? `${pieceName(piece)} (${piece.owner})` : id;
  };
  const kind =
    arrow.kind === "move"
      ? m.board_states_editor_arrow_move()
      : m.board_states_editor_arrow_target();
  const target =
    "piece" in arrow.to ? nameOf(arrow.to.piece) : describeZone(arrow.to.zone, arrow.to.owner);
  return `${kind}: ${nameOf(arrow.from)} → ${target}`;
}
