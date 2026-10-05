import { useDraggable, useDroppable } from "@dnd-kit/core";
import type {
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import {
  BOARD_PLAYERS,
  emptyBattlefieldState,
  shownBattlefields,
} from "@openrift/shared/board-state";
import { imageUrl } from "@openrift/shared/image-url";
import { ChevronsUpIcon, DropletIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";

import { CardIcon } from "@/components/card-icon";
import { Pressable } from "@/components/ui/pressable";
import {
  ArrowLegend,
  ArrowOverlay,
  arrowLayoutSignature,
} from "@/features/board-states/components/board-arrows";
import type {
  PieceDragData,
  PieceDropData,
  ZoneDropData,
} from "@/features/board-states/components/board-card-parts";
import {
  ArrowHandle,
  BattlefieldCardFrame,
  CardBack,
  cardImageId,
  KeywordBadgeChip,
} from "@/features/board-states/components/board-card-parts";
import type { ChainInteraction } from "@/features/board-states/components/board-chain";
import { ChainRow } from "@/features/board-states/components/board-chain";
import {
  BattlefieldStateBadges,
  BoardSeatStats,
  BoardTurnBar,
} from "@/features/board-states/components/board-status";
import { EmptyZoneStrip, ZoneLabel } from "@/features/board-states/components/board-zone-labels";
import { pieceName, ZONE_LABEL } from "@/features/board-states/lib/board-labels";
import type { SeatZone } from "@/features/board-states/lib/board-layout";
import {
  arrowZoneKey,
  boardWidthUnits,
  grantedLegendSlots,
  occupiedZones,
  pieceNumerals,
  piecesAt,
  seatSlots,
  seatsFor,
  zoneAcceptsMore,
} from "@/features/board-states/lib/board-layout";
import {
  CARD_CORNER_STYLE,
  CARD_ROW_HEIGHT,
  CARD_TURNED,
  CARD_UPRIGHT,
  PLAYER_COLOR,
  seatInk,
  zoneEdge,
} from "@/features/board-states/lib/board-style";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCardHoverPreview } from "@/features/rules/components/rule-card-preview";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCardModifierKeywords, useKeywordStyles } from "@/hooks/use-keyword-styles";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

const UNKNOWN_KEYWORD = { color: "#707070", darkText: false };

interface BoardInteraction extends ChainInteraction {
  selectedPieceId?: string | null;
  selectedPieceIds?: readonly string[];
  highlightedPieceId?: string | null;
  pieceNumerals?: boolean;
  cardPreview?: boolean;
  onPieceClick?: (piece: BoardPiece, event: React.MouseEvent) => void;
  onPieceContextMenu?: (piece: BoardPiece, event: React.MouseEvent) => void;
  onZoneClick?: (zone: BoardZoneRef, owner?: BoardPlayer) => void;
  /** A card is armed for placement: every zone invites a click. */
  zonesArmed?: boolean;
  renderZoneAdd?: (zone: BoardZoneRef, owner: BoardPlayer) => ReactNode;
  renderBattlefieldCard?: (index: number, cardName: string | null, image?: string) => ReactNode;
  renderPieceOverlay?: (piece: BoardPiece) => ReactNode;
}

interface KeywordBadge {
  color: string;
  darkText: boolean;
  label: string;
}

interface BoardArt {
  pieceImageIds: Map<string, string>;
  chainImageIds: Map<string, string>;
  battlefieldImageIds: Map<number, string>;
  keywords: Map<string, KeywordBadge>;
  grantedLegendSlots: Map<BoardPlayer, number>;
}

const PLAIN_ART: BoardArt = {
  pieceImageIds: new Map(),
  chainImageIds: new Map(),
  battlefieldImageIds: new Map(),
  keywords: new Map(),
  grantedLegendSlots: new Map(),
};

interface BoardViewProps extends BoardInteraction {
  document: BoardDocument;
  step: BoardStep;
  viewer?: boolean;
  hideEmptyZones?: boolean;
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

function BoardTableWithArt(props: BoardViewProps) {
  const catalog = useCards();
  const styles = useKeywordStyles();
  const modifiers = useCardModifierKeywords();
  const locale = getLocale();

  const pieceImageIds = new Map<string, string>();
  for (const piece of props.step.pieces) {
    const id = piece.card ? cardImageId(piece.card, catalog) : undefined;
    if (id !== undefined) {
      pieceImageIds.set(piece.id, id);
    }
  }
  const chainImageIds = new Map<string, string>();
  for (const entry of props.step.chain) {
    const id = entry.card
      ? cardImageId(entry.card, catalog)
      : pieceImageIds.get(entry.source ?? "");
    if (id !== undefined) {
      chainImageIds.set(entry.id, id);
    }
  }
  const battlefieldImageIds = new Map<number, string>();
  for (const [index, battlefield] of props.document.battlefields.entries()) {
    const id = battlefield.card ? cardImageId(battlefield.card, catalog) : undefined;
    if (id !== undefined) {
      battlefieldImageIds.set(index, id);
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
  const grantsLegends = (cardId: string) =>
    (catalog.cardsById[cardId]?.additionalLegendCount ?? 0) > 0;
  const grantedLegendSlotsByPlayer = new Map(
    BOARD_PLAYERS.map((player) => [
      player,
      grantedLegendSlots(props.step.pieces, player, grantsLegends),
    ]),
  );
  return (
    <BoardTable
      {...props}
      art={{
        pieceImageIds,
        chainImageIds,
        battlefieldImageIds,
        keywords,
        grantedLegendSlots: grantedLegendSlotsByPlayer,
      }}
    />
  );
}

interface BoardTableProps extends BoardViewProps {
  art: BoardArt;
}

function BoardTable({
  document,
  step,
  viewer = false,
  hideEmptyZones = false,
  className,
  art,
  ...rest
}: BoardTableProps) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const cardPreview = useCardHoverPreview("[data-board-preview]");
  const previewHandlers =
    rest.cardPreview === false
      ? {}
      : {
          onPointerOver: cardPreview.handlePointerOver,
          onPointerOut: cardPreview.handlePointerOut,
          onPointerDown: cardPreview.handlePointerDown,
        };
  const interaction: BoardInteraction = {
    ...rest,
    highlightedPieceId: hoveredSource ?? rest.highlightedPieceId,
  };
  const seats = seatsFor(document.playerCount);
  const slots = seatSlots(document.zones);
  const numerals = interaction.pieceNumerals === false ? new Map() : pieceNumerals(step.pieces);
  const containerRef = useRef<HTMLDivElement>(null);
  const context: BoardContext = {
    document,
    step,
    art,
    numerals,
    interaction,
    zones: document.zones,
    viewer,
    occupied: viewer || hideEmptyZones ? occupiedZones(document.steps) : null,
  };
  const battlefields =
    viewer || hideEmptyZones
      ? shownBattlefields(document)
      : document.battlefields.map((_, index) => index);
  const units = viewer ? boardWidthUnits(document.steps, document.zones, seats, battlefields) : 0;
  return (
    <div
      className={cn(
        "bg-board-felt border-board-felt-edge overflow-x-auto rounded-lg border-2 p-2 text-white sm:p-3",
        viewer && "@container",
        className,
      )}
      {...previewHandlers}
      style={
        viewer
          ? ({
              "--board-card-w": `clamp(5.5rem, calc((100cqi - 2rem) / ${units.toFixed(2)}), 9rem)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex min-w-0 gap-2 sm:gap-3">
        <div ref={containerRef} className="relative flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
          <BoardTurnBar turn={step.turn} />
          {document.zones.chain && !viewer && (
            <ChainRow
              chain={step.chain}
              pieces={step.pieces}
              imageIds={art.chainImageIds}
              interaction={interaction}
              onHoverSource={setHoveredSource}
            />
          )}
          <SeatSide players={seats.top} slots={slots} top context={context} />
          <BattlefieldRow indexes={battlefields} seats={seats} context={context} />
          <SeatSide players={seats.bottom} slots={slots} context={context} />
          <ArrowOverlay
            key={arrowLayoutSignature(document, step)}
            containerRef={containerRef}
            arrows={step.arrows}
          />
        </div>
      </div>
      <ArrowLegend arrows={step.arrows} />
      {cardPreview.preview}
    </div>
  );
}

interface BoardContext {
  document: BoardDocument;
  step: BoardStep;
  viewer: boolean;
  occupied: Set<string> | null;
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
  slots: SeatZone[];
  /** The far seat: its hand strip sits at the table edge, above the zones. */
  top?: boolean;
  context: BoardContext;
}) {
  const { document, step } = context;
  const hasStats = players.some((player) => step.players[player] !== undefined);
  if (players.length === 0 || (slots.length === 0 && !context.zones.hand && !hasStats)) {
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
            <BoardSeatStats
              player={player}
              stats={step.players}
              scoring={document.scoring}
              showScore={document.zones.score}
            />
            {(slots.length > 0 || (context.viewer && context.zones.hand)) && (
              <div className="relative flex min-w-0 flex-wrap items-stretch gap-1.5">
                {slots.map((slot) => (
                  <SeatSlotCell key={slot} zone={slot} owner={player} context={context} />
                ))}
                {context.viewer && context.zones.hand && (
                  <HandStrip owner={player} context={context} />
                )}
              </div>
            )}
            {!context.viewer && context.zones.hand && (
              <HandStrip owner={player} context={context} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function isOccupied(context: BoardContext, zone: BoardZoneRef, owner: BoardPlayer): boolean {
  return context.occupied === null || context.occupied.has(arrowZoneKey(zone, owner));
}

function SeatSlotCell({
  zone,
  owner,
  mirrored,
  context,
}: {
  zone: SeatZone;
  owner: BoardPlayer;
  mirrored?: boolean;
  context: BoardContext;
}) {
  if (zone === "deck" || zone === "runeDeck") {
    return <DeckZone kind={zone} owner={owner} mirrored={mirrored} context={context} />;
  }
  return <PlayerZone kind={zone} owner={owner} mirrored={mirrored} context={context} />;
}

/** Placed cards are the known top of the deck, top card first, beside the rest of the stack. */
function DeckZone({
  kind,
  owner,
  mirrored,
  context,
}: {
  kind: "deck" | "runeDeck";
  owner: BoardPlayer;
  mirrored?: boolean;
  context: BoardContext;
}) {
  const zone: BoardZoneRef = { kind };
  const count = kind === "deck" ? context.step.players[owner]?.deckCount : undefined;
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={context.interaction}
      mirrored={mirrored}
      className="min-h-[calc(var(--board-card-w)*1.4+1.4rem)] border bg-black/15"
      style={{ borderColor: zoneEdge(owner) }}
    >
      <ZoneLabel text={ZONE_LABEL[kind]()} owner={owner} mirrored={mirrored} />
      <span className="relative shrink-0 self-end">
        <CardBack owner={owner} />
        {count !== undefined && (
          <span
            className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-full bg-black/75 px-1.5 text-sm font-semibold tabular-nums"
            title={m.board_states_stat_deck_count()}
          >
            {count}
          </span>
        )}
      </span>
      <PieceRow
        pieces={piecesAt(context.step, zone, owner)}
        mirrored={mirrored}
        context={context}
        trailing={context.interaction.renderZoneAdd?.(zone, owner)}
      />
    </ZoneFrame>
  );
}

interface ZoneFrameProps {
  zone: BoardZoneRef;
  /** Absent for a battlefield's shared facedown zone. */
  owner?: BoardPlayer;
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

function DroppableZoneFrame(props: ZoneFrameProps) {
  const data: ZoneDropData = { type: "board-zone", zone: props.zone, owner: props.owner };
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${arrowZoneKey(props.zone, props.owner ?? "A")}`,
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
  const zoneKey = arrowZoneKey(zone, owner ?? "A");
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
  if (!isOccupied(context, zone, owner)) {
    return (
      <EmptyZoneStrip
        zone={zone}
        owner={owner}
        label={ZONE_LABEL[kind]()}
        className={cn("self-stretch", kind === "base" && "flex-1")}
      />
    );
  }
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={context.interaction}
      mirrored={mirrored}
      fill={kind === "base"}
      className={cn(
        "min-h-[calc(var(--board-card-w)*1.4+1.4rem)] border",
        "bg-black/15",
        kind === "base" && "min-w-[calc(var(--board-card-w)*2.9)]",
        kind === "runes" && "min-w-[calc(var(--board-card-w)*2.3)]",
        kind !== "base" && kind !== "runes" && "w-auto min-w-[calc(var(--board-card-w)+1.8rem)]",
      )}
      style={{ borderColor: zoneEdge(owner) }}
    >
      <ZoneLabel text={ZONE_LABEL[kind]()} owner={owner} mirrored={mirrored} />
      <PieceRow
        pieces={piecesAt(context.step, zone, owner)}
        mirrored={mirrored}
        context={context}
        trailing={
          zoneAcceptsMore(
            zone,
            piecesAt(context.step, zone, owner).length,
            kind === "legend" ? (context.art.grantedLegendSlots.get(owner) ?? 0) : 0,
          )
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
  if (!isOccupied(context, zone, owner)) {
    return (
      <EmptyZoneStrip
        zone={zone}
        owner={owner}
        label={ZONE_LABEL.hand()}
        className="flex-1 self-stretch"
      />
    );
  }
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={context.interaction}
      mirrored={mirrored}
      fill
      className={cn(
        "min-h-[calc(var(--board-card-w)*1.4+0.5rem)] items-center border",
        "bg-black/15",
        context.viewer && "min-w-[calc(var(--board-card-w)*2.9)]",
      )}
      style={{ borderColor: zoneEdge(owner) }}
    >
      <ZoneLabel text={ZONE_LABEL.hand()} owner={owner} mirrored={mirrored} />
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
  indexes,
  seats,
  context,
}: {
  indexes: readonly number[];
  seats: ReturnType<typeof seatsFor>;
  context: BoardContext;
}) {
  if (indexes.length === 0) {
    return null;
  }
  const players = [...seats.top, ...seats.bottom];
  const columns = indexes.map((index) =>
    players.some((player) => isOccupied(context, { kind: "battlefield", index }, player))
      ? "minmax(0, 1fr)"
      : "auto",
  );
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 sm:[grid-template-columns:var(--battlefield-cols)] sm:gap-3",
        context.viewer && "sm:items-center",
      )}
      style={{ "--battlefield-cols": columns.join(" ") } as React.CSSProperties}
    >
      {indexes.map((index) => (
        <BattlefieldColumn
          key={index}
          index={index}
          cardName={context.document.battlefields[index]?.card?.name ?? null}
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
  const imageId = context.art.battlefieldImageIds.get(index);
  const image = imageId === undefined ? undefined : imageUrl(imageId, "240w");
  const state = context.step.battlefields[index] ?? emptyBattlefieldState();
  const controller = state.controller;
  const half = (players: BoardPlayer[]) => {
    const columns = {
      gridTemplateColumns: `repeat(${Math.max(1, players.length)}, minmax(0, 1fr))`,
    };
    if (!players.some((player) => isOccupied(context, zone, player))) {
      return (
        <div className="grid gap-1.5" style={columns}>
          {players.map((player) => (
            <EmptyZoneStrip key={player} zone={zone} owner={player} />
          ))}
        </div>
      );
    }
    return (
      <div className={cn("grid gap-1.5", CARD_ROW_HEIGHT)} style={columns}>
        {players.map((player) => (
          <ZoneFrame
            key={player}
            zone={zone}
            owner={player}
            interaction={context.interaction}
            fill
            className="relative items-center justify-center border bg-black/15"
            style={{ borderColor: zoneEdge(player) }}
          >
            <span
              aria-hidden
              className="text-2xs pointer-events-none absolute top-1 left-1.5 font-semibold"
              style={{ color: seatInk(player) }}
            >
              {player}
            </span>
            <PieceRow
              pieces={piecesAt(context.step, zone, player)}
              context={context}
              trailing={context.interaction.renderZoneAdd?.(zone, player)}
            />
          </ZoneFrame>
        ))}
      </div>
    );
  };
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg bg-black/25 p-1.5",
        controller === null ? "ring-1 ring-white/10" : "ring-2",
      )}
      style={
        controller === null
          ? undefined
          : ({ "--tw-ring-color": PLAYER_COLOR[controller] } as React.CSSProperties)
      }
    >
      {half(seats.top)}
      <div className="relative flex items-center justify-center gap-1.5">
        <BattlefieldStateBadges state={state} />
        <span
          className="flex min-w-0"
          data-board-preview={imageId === undefined ? undefined : ""}
          data-card-image={imageId}
          data-card-landscape=""
        >
          {context.interaction.renderBattlefieldCard ? (
            context.interaction.renderBattlefieldCard(index, cardName, image)
          ) : (
            <BattlefieldCardFrame index={index} cardName={cardName} image={image} />
          )}
        </span>
        <FacedownZone index={index} controller={controller} seats={seats} context={context} />
      </div>
      {half(seats.bottom)}
    </div>
  );
}

/** Shown in the editor, or once it holds a card; a facedown card belongs to the battlefield. */
function FacedownZone({
  index,
  controller,
  seats,
  context,
}: {
  index: number;
  controller: BoardPlayer | null;
  seats: ReturnType<typeof seatsFor>;
  context: BoardContext;
}) {
  const zone: BoardZoneRef = { kind: "facedown", index };
  const pieces = piecesAt(context.step, zone);
  const adder = controller ?? seats.bottom[0] ?? "A";
  const trailing = zoneAcceptsMore(zone, pieces.length)
    ? context.interaction.renderZoneAdd?.(zone, adder)
    : undefined;
  if (pieces.length === 0 && (trailing === undefined || trailing === null)) {
    return null;
  }
  return (
    <ZoneFrame
      zone={zone}
      interaction={context.interaction}
      className="items-center border border-white/20 bg-black/15"
    >
      <span className="text-2xs text-white/60 uppercase">{ZONE_LABEL.facedown()}</span>
      <PieceRow pieces={pieces} context={context} trailing={trailing} />
    </ZoneFrame>
  );
}

/** Pulls a stacked card over the previous one so the same strip of it stays visible, upright or turned. */
function overlapMargin(previousTurned: boolean): string {
  return previousTurned
    ? "-ml-[calc(var(--board-card-w)*1.08)]"
    : "-ml-[calc(var(--board-card-w)*0.68)]";
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

function PieceToken({ piece, mirrored, context }: PieceProps) {
  const { interaction } = context;
  const selected =
    interaction.selectedPieceId === piece.id ||
    (interaction.selectedPieceIds?.includes(piece.id) ?? false);
  const spotlit = interaction.highlightedPieceId === piece.id;
  const glow = piece.highlight || spotlit;
  const numeral = context.numerals.get(piece.id);
  const imageId = context.art.pieceImageIds.get(piece.id);
  const image = imageId === undefined ? undefined : imageUrl(imageId, "240w");
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
        {piece.facedown && (
          <span className="absolute inset-0 transition-opacity group-hover/piece:opacity-0 group-focus/piece:opacity-0">
            <CardBack owner={piece.owner} className="size-full border-0" />
          </span>
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
            <CardIcon src="/images/might.svg" className="size-2" />
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
        {piece.buffs > 0 && (
          <span
            className="bg-gilt text-2xs absolute -right-1 -bottom-1 flex items-center rounded-full px-0.5 font-semibold text-black"
            title={m.board_states_state_buffs({ count: piece.buffs })}
          >
            <ChevronsUpIcon className="size-2.5" aria-hidden />
            {piece.buffs > 1 ? piece.buffs : null}
          </span>
        )}
        {piece.counter !== undefined && (
          <span className="text-2xs absolute inset-x-0 bottom-1 mx-auto w-fit rounded-sm bg-black/80 px-1 font-semibold whitespace-nowrap text-white tabular-nums">
            {piece.counter.label === undefined
              ? piece.counter.value
              : `${piece.counter.label} ${piece.counter.value}`}
          </span>
        )}
        {(piece.keywords.length > 0 || piece.label !== undefined) && (
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 flex-col items-center gap-px">
            {piece.keywords.map((keyword) => (
              <KeywordBadgeChip
                key={keyword}
                keyword={keyword}
                badge={context.art.keywords.get(keyword)}
              />
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
      data-board-preview={imageId === undefined ? undefined : ""}
      data-card-image={imageId}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a facedown card reveals itself on focus for keyboard readers
      tabIndex={piece.facedown && !interaction.onPieceClick ? 0 : undefined}
      className={cn(
        "group/piece relative block shrink-0 transition-transform",
        piece.exhausted ? CARD_TURNED : CARD_UPRIGHT,
        spotlit && "scale-105",
      )}
      title={
        piece.facedown
          ? m.board_states_facedown_title({ name: pieceName(piece) })
          : pieceName(piece)
      }
    >
      {face}
      {(handle || overlay !== undefined) && (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 [&>*]:pointer-events-auto",
            mirrored === true && "rotate-180",
          )}
        >
          {handle && <ArrowHandle from={{ piece: piece.id }} />}
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
