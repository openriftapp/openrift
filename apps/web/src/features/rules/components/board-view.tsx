import { useDraggable, useDroppable } from "@dnd-kit/core";
import type {
  BoardArrow,
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { Pressable } from "@/components/ui/pressable";
import type { ZoneSlot } from "@/features/rules/lib/board-layout";
import {
  arrowZoneKey,
  piecesAt,
  playerRows,
  rowIsVisible,
  seatsFor,
} from "@/features/rules/lib/board-layout";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const PLAYER_COLOR: Record<BoardPlayer, string> = {
  A: "oklch(0.55 0.08 195)",
  B: "oklch(0.6 0.1 75)",
  C: "oklch(0.55 0.1 330)",
  D: "oklch(0.55 0.1 140)",
};

const ZONE_LABEL: Record<PlayerZoneKind, () => string> = {
  base: m.board_states_zone_base,
  legend: m.board_states_zone_legend,
  champion: m.board_states_zone_champion,
  runes: m.board_states_zone_runes,
  hand: m.board_states_zone_hand,
  trash: m.board_states_zone_trash,
};

export interface BoardInteraction {
  selectedPieceId?: string | null;
  onPieceClick?: (piece: BoardPiece) => void;
  onZoneClick?: (zone: BoardZoneRef, owner: BoardPlayer) => void;
  /** Requires a surrounding `DndContext`. */
  draggable?: boolean;
  renderZoneAdd?: (zone: BoardZoneRef, owner: BoardPlayer) => ReactNode;
  renderBattlefieldCard?: (index: number, cardName: string | null) => ReactNode;
}

export interface PieceDragData {
  type: "board-piece";
  pieceId: string;
}

export interface ZoneDropData {
  type: "board-zone";
  zone: BoardZoneRef;
  owner: BoardPlayer;
}

interface BoardViewProps extends BoardInteraction {
  document: BoardDocument;
  step: BoardStep;
  className?: string;
}

export function BoardView({ document, step, className, ...interaction }: BoardViewProps) {
  const seats = seatsFor(document.playerCount);
  const rows = playerRows(document.zones);
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={cn(
        "bg-muted/60 border-border flex gap-2 overflow-x-auto rounded-md border p-2 sm:gap-3 sm:p-3",
        className,
      )}
    >
      <div ref={containerRef} className="relative flex min-w-0 flex-1 flex-col gap-2">
        <SeatRow
          players={seats.top}
          step={step}
          rows={[rows.far, rows.near]}
          interaction={interaction}
        />
        {document.battlefields.length > 0 && (
          <div
            className="grid grid-cols-1 gap-2 sm:[grid-template-columns:var(--battlefield-cols)]"
            style={
              {
                "--battlefield-cols": `repeat(${document.battlefields.length}, minmax(0, 1fr))`,
              } as React.CSSProperties
            }
          >
            {document.battlefields.map((battlefield, index) => (
              <BattlefieldZone
                // oxlint-disable-next-line react/no-array-index-key -- battlefields are positional
                key={index}
                index={index}
                cardName={battlefield.card?.name ?? null}
                step={step}
                seats={seats}
                interaction={interaction}
              />
            ))}
          </div>
        )}
        <SeatRow
          players={seats.bottom}
          step={step}
          rows={[rows.near, rows.far]}
          interaction={interaction}
        />
        <ArrowOverlay
          key={`${document.playerCount}:${document.battlefields.length}:${Object.values(document.zones).join(",")}`}
          containerRef={containerRef}
          arrows={step.arrows}
        />
      </div>
      {document.zones.chain && <ChainColumn step={step} />}
    </div>
  );
}

interface ArrowLine {
  kind: BoardArrow["kind"];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function centerOf(element: Element, origin: DOMRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - origin.left + rect.width / 2,
    y: rect.top - origin.top + rect.height / 2,
  };
}

function measureArrows(container: HTMLElement, arrows: BoardArrow[]): ArrowLine[] {
  const origin = container.getBoundingClientRect();
  const lines: ArrowLine[] = [];
  for (const arrow of arrows) {
    const from = container.querySelector(`[data-board-piece="${arrow.from}"]`);
    const toSelector =
      "piece" in arrow.to
        ? `[data-board-piece="${arrow.to.piece}"]`
        : `[data-board-zone="${arrowZoneKey(arrow.to.zone, arrow.to.owner)}"]`;
    const to = container.querySelector(toSelector);
    if (!from || !to) {
      continue;
    }
    const start = centerOf(from, origin);
    const end = centerOf(to, origin);
    lines.push({ kind: arrow.kind, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
  }
  return lines;
}

function ArrowOverlay({
  containerRef,
  arrows,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  arrows: BoardArrow[];
}) {
  const [lines, setLines] = useState<ArrowLine[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const update = () => setLines(measureArrows(container, arrows));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, arrows]);

  if (lines.length === 0) {
    return null;
  }
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      <defs>
        <marker
          id="board-arrow-head"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" className="fill-foreground" />
        </marker>
      </defs>
      {lines.map((line, index) => (
        <line
          // oxlint-disable-next-line react/no-array-index-key -- arrows are positional
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          className="stroke-foreground"
          strokeWidth={2.5}
          strokeDasharray={line.kind === "move" ? "6 4" : undefined}
          markerEnd="url(#board-arrow-head)"
        />
      ))}
    </svg>
  );
}

function SeatRow({
  players,
  step,
  rows,
  interaction,
}: {
  players: BoardPlayer[];
  step: BoardStep;
  rows: ZoneSlot[][];
  interaction: BoardInteraction;
}) {
  const visibleRows = rows.filter((row) => rowIsVisible(row));
  if (visibleRows.length === 0) {
    return null;
  }
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}
    >
      {players.map((player) => (
        <div key={player} className="flex min-w-0 flex-col gap-2">
          {visibleRows.map((row) => (
            <div key={row.map((slot) => slot.kind).join(",")} className="grid grid-cols-3 gap-2">
              {row.map((slot) =>
                slot.visible ? (
                  <PlayerZone
                    key={slot.kind}
                    kind={slot.kind}
                    owner={player}
                    step={step}
                    interaction={interaction}
                  />
                ) : (
                  <div key={slot.kind} />
                ),
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface ZoneFrameProps {
  zone: BoardZoneRef;
  owner: BoardPlayer;
  interaction: BoardInteraction;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

function ZoneFrame(props: ZoneFrameProps) {
  const frame = props.interaction.draggable ? (
    <DroppableZoneFrame {...props} />
  ) : (
    <ZoneFrameBody {...props} />
  );
  const { renderZoneAdd } = props.interaction;
  if (!renderZoneAdd) {
    return frame;
  }
  return (
    <div className="relative flex min-w-0 flex-col">
      {frame}
      <div className="absolute top-0.5 right-0.5">{renderZoneAdd(props.zone, props.owner)}</div>
    </div>
  );
}

function DroppableZoneFrame(props: ZoneFrameProps) {
  const data: ZoneDropData = { type: "board-zone", zone: props.zone, owner: props.owner };
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${arrowZoneKey(props.zone, props.owner)}`,
    data,
  });
  return (
    <div ref={setNodeRef} className={cn("flex min-w-0", isOver && "ring-ring rounded-md ring-2")}>
      <ZoneFrameBody {...props} className={cn(props.className, "flex-1")} />
    </div>
  );
}

function ZoneFrameBody({ zone, owner, interaction, className, style, children }: ZoneFrameProps) {
  const classes = cn("flex min-h-16 min-w-0 flex-col gap-1 rounded-md p-1.5 text-left", className);
  const zoneKey = arrowZoneKey(zone, owner);
  if (!interaction.onZoneClick) {
    return (
      <div className={classes} style={style} data-board-zone={zoneKey}>
        {children}
      </div>
    );
  }
  const { onZoneClick } = interaction;
  return (
    <Pressable
      className={cn(classes, "hover:ring-ring hover:ring-2")}
      style={style}
      data-board-zone={zoneKey}
      onClick={() => onZoneClick(zone, owner)}
    >
      {children}
    </Pressable>
  );
}

function PlayerZone({
  kind,
  owner,
  step,
  interaction,
}: {
  kind: PlayerZoneKind;
  owner: BoardPlayer;
  step: BoardStep;
  interaction: BoardInteraction;
}) {
  const zone: BoardZoneRef = { kind };
  const pieces = piecesAt(step, zone, owner);
  return (
    <ZoneFrame
      zone={zone}
      owner={owner}
      interaction={interaction}
      className="border border-dashed"
      style={{ borderColor: PLAYER_COLOR[owner] }}
    >
      <span className="text-2xs text-muted-foreground uppercase">
        {ZONE_LABEL[kind]()} <span style={{ color: PLAYER_COLOR[owner] }}>{owner}</span>
      </span>
      <PieceList pieces={pieces} interaction={interaction} />
    </ZoneFrame>
  );
}

function BattlefieldZone({
  index,
  cardName,
  step,
  seats,
  interaction,
}: {
  index: number;
  cardName: string | null;
  step: BoardStep;
  seats: ReturnType<typeof seatsFor>;
  interaction: BoardInteraction;
}) {
  const zone: BoardZoneRef = { kind: "battlefield", index };
  const half = (players: BoardPlayer[]) => (
    <div className="flex min-w-0 flex-col gap-1">
      {players.map((player) => (
        <ZoneFrame
          key={player}
          zone={zone}
          owner={player}
          interaction={interaction}
          className="min-h-12 border-l-4 py-1"
          style={{ borderLeftColor: PLAYER_COLOR[player] }}
        >
          <PieceList pieces={piecesAt(step, zone, player)} interaction={interaction} />
        </ZoneFrame>
      ))}
    </div>
  );
  return (
    <div className="bg-card border-border-accent flex min-w-0 flex-col gap-1 rounded-md border p-1.5">
      {half(seats.top)}
      {interaction.renderBattlefieldCard ? (
        interaction.renderBattlefieldCard(index, cardName)
      ) : (
        <div className="border-border-accent bg-secondary flex items-center justify-center rounded-sm border px-2 py-1 text-center text-xs font-semibold">
          {cardName ?? m.board_states_battlefield({ number: index + 1 })}
        </div>
      )}
      {half(seats.bottom)}
    </div>
  );
}

function PieceList({
  pieces,
  interaction,
}: {
  pieces: BoardPiece[];
  interaction: BoardInteraction;
}) {
  if (pieces.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pieces.map((piece) => {
        const handlePieceClick = interaction.onPieceClick;
        return interaction.draggable ? (
          <DraggablePiece
            key={piece.id}
            piece={piece}
            selected={interaction.selectedPieceId === piece.id}
            onClick={handlePieceClick}
          />
        ) : (
          <PieceToken
            key={piece.id}
            piece={piece}
            selected={interaction.selectedPieceId === piece.id}
            onClick={handlePieceClick}
          />
        );
      })}
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

interface PieceTokenProps {
  piece: BoardPiece;
  selected: boolean;
  onClick?: (piece: BoardPiece) => void;
}

function DraggablePiece(props: PieceTokenProps) {
  const data: PieceDragData = { type: "board-piece", pieceId: props.piece.id };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `piece:${props.piece.id}`,
    data,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={isDragging ? { opacity: 0.4 } : undefined}
    >
      <PieceToken {...props} />
    </div>
  );
}

function PieceToken({ piece, selected, onClick }: PieceTokenProps) {
  const body = (
    <span
      data-board-piece={piece.id}
      className={cn(
        "bg-card text-2xs relative flex flex-col justify-between overflow-visible rounded-sm border-2 p-0.5 text-left",
        piece.exhausted ? "h-10 w-14" : "h-14 w-10",
        piece.highlight && "ring-primary ring-2 ring-offset-1",
        selected && "ring-ring ring-2 ring-offset-2",
      )}
      style={{ borderColor: PLAYER_COLOR[piece.owner] }}
      title={pieceName(piece)}
    >
      <span className="line-clamp-2 break-words">{pieceName(piece)}</span>
      <span className="flex items-end justify-between gap-0.5">
        <span className="font-semibold" style={{ color: PLAYER_COLOR[piece.owner] }}>
          {piece.owner}
        </span>
        {piece.damage > 0 && (
          <span className="bg-destructive text-destructive-foreground rounded-sm px-0.5">
            {piece.damage}
          </span>
        )}
        {piece.buff > 0 && (
          <span className="bg-primary text-primary-foreground rounded-sm px-0.5">
            +{piece.buff}
          </span>
        )}
      </span>
      {(piece.stunned || piece.label) && (
        <span className="bg-foreground text-background absolute -top-2 left-1/2 -translate-x-1/2 rounded-sm px-1 whitespace-nowrap">
          {piece.stunned ? m.board_states_state_stunned() : piece.label}
        </span>
      )}
    </span>
  );
  if (!onClick) {
    return body;
  }
  return (
    <Pressable
      className="rounded-sm"
      onClick={(event) => {
        event.stopPropagation();
        onClick(piece);
      }}
      aria-label={pieceName(piece)}
    >
      {body}
    </Pressable>
  );
}

function ChainColumn({ step }: { step: BoardStep }) {
  return (
    <div className="border-border flex w-36 shrink-0 flex-col gap-1 rounded-md border border-dashed p-1.5 sm:w-44">
      <span className="text-2xs text-muted-foreground uppercase">{m.board_states_chain()}</span>
      {step.chain.toReversed().map((entry, index) => (
        <span
          // oxlint-disable-next-line react/no-array-index-key -- chain entries are positional
          key={index}
          className="bg-card rounded-sm border-l-4 px-1.5 py-0.5 text-xs"
          style={{ borderLeftColor: PLAYER_COLOR[entry.owner] }}
        >
          {entry.owner}: {entry.card ? `${entry.card.name} · ` : ""}
          {entry.text}
        </span>
      ))}
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
