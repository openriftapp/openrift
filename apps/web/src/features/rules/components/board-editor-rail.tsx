import { useDraggable } from "@dnd-kit/core";
import type {
  BoardCardRef,
  BoardPiece,
  BoardPlayer,
  PieceKind,
} from "@openrift/shared/board-state";
import { PIECE_KINDS } from "@openrift/shared/board-state";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { Card } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { ChevronDownIcon, ShapesIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { PreferredPrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import { pieceMarks } from "@/features/rules/components/board-editor-piece-actions";
import { describeZone, PLAYER_COLOR, pieceName } from "@/features/rules/components/board-view";
import type { BoardPieceActions } from "@/features/rules/hooks/use-board-editor-piece-actions";
import type { NewPieceDragData } from "@/features/rules/lib/board-editor-drag";
import { pieceKindForCardTypes } from "@/features/rules/lib/board-layout";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const PIECE_KIND_LABEL: Record<PieceKind, () => string> = {
  unit: m.board_states_piece_unit,
  spell: m.board_states_piece_spell,
  gear: m.board_states_piece_gear,
  rune: m.board_states_piece_rune,
  legend: m.board_states_piece_legend,
  token: m.board_states_piece_token,
};

export interface Placement {
  owner: BoardPlayer;
  kind: PieceKind;
  card: BoardCardRef | null;
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs uppercase">{title}</h2>
      {children}
    </section>
  );
}

function ownerLabel(player: BoardPlayer, playerCount: number): string {
  if (playerCount !== 2) {
    return player;
  }
  const seat =
    player === "A" ? m.board_states_editor_seat_you() : m.board_states_editor_seat_opponent();
  return `${player} · ${seat}`;
}

function OwnerPills({
  players,
  playerCount,
  value,
  onChange,
}: {
  players: readonly BoardPlayer[];
  playerCount: number;
  value: BoardPlayer;
  onChange: (player: BoardPlayer) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((player) => (
        <Toggle
          key={player}
          size="sm"
          variant="outline"
          pressed={player === value}
          onPressedChange={() => onChange(player)}
          style={player === value ? { borderColor: PLAYER_COLOR[player] } : undefined}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: PLAYER_COLOR[player] }}
            aria-hidden
          />
          {ownerLabel(player, playerCount)}
        </Toggle>
      ))}
    </div>
  );
}

function DraggableSource({
  id,
  data,
  className,
  onClick,
  label,
  children,
}: {
  id: string;
  data: NewPieceDragData;
  className?: string;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, data });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("min-w-0", isDragging && "opacity-40")}
    >
      <Pressable className={className} aria-label={label} onClick={onClick}>
        {children}
      </Pressable>
    </div>
  );
}

function CardResult({
  cardId,
  card,
  owner,
  active,
  onPick,
}: {
  cardId: string;
  card: Card;
  owner: BoardPlayer;
  active: boolean;
  onPick: (placement: Placement) => void;
}) {
  const { printingsByCardId } = useCards();
  const name = legendDisplayName(card);
  const printing = printingsByCardId.get(cardId)?.[0];
  const placement: Placement = {
    owner,
    kind: pieceKindForCardTypes(card.types),
    card: { cardId, name },
  };
  return (
    <DraggableSource
      id={`new-card:${cardId}`}
      data={{ type: "board-new-piece", ...placement }}
      onClick={() => onPick(placement)}
      label={name}
      className={cn(
        "hover:bg-muted flex w-full min-w-0 items-center gap-2 rounded-md p-1 text-left",
        active && "bg-muted ring-ring ring-2",
      )}
    >
      <PreferredPrintingThumbnail cardId={cardId} className="h-9" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{name}</span>
        {printing ? (
          <span className="text-muted-foreground text-2xs truncate">
            {formatPrintingCode(printing.publicCode)}
          </span>
        ) : null}
      </span>
    </DraggableSource>
  );
}

function CardSearch({
  owner,
  placement,
  onPick,
}: {
  owner: BoardPlayer;
  placement: Placement | null;
  onPick: (placement: Placement) => void;
}) {
  const { cardsById } = useCards();
  const [query, setQuery] = useState("");
  const results = useCatalogCardSearch(query.trim(), undefined, undefined, 1);
  return (
    <div className="relative flex flex-col">
      <Input
        value={query}
        placeholder={m.board_states_editor_search_cards()}
        className="w-56"
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() === "" ? null : results.length === 0 ? (
        <span className="bg-popover ring-border text-muted-foreground absolute top-full left-0 z-40 mt-1 rounded-md px-2 py-1 text-sm shadow-md ring-1">
          {m.board_states_editor_no_cards()}
        </span>
      ) : (
        <div className="bg-popover ring-border absolute top-full left-0 z-40 mt-1 flex max-h-72 w-80 flex-col gap-0.5 overflow-y-auto rounded-md p-1 shadow-md ring-1">
          {results.map((result) => {
            const card = cardsById[result.id];
            return card ? (
              <CardResult
                key={result.id}
                cardId={result.id}
                card={card}
                owner={owner}
                active={placement?.card?.cardId === result.id}
                onPick={(next) => {
                  onPick(next);
                  setQuery("");
                }}
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function GenericPieces({
  owner,
  placement,
  onPick,
}: {
  owner: BoardPlayer;
  placement: Placement | null;
  onPick: (placement: Placement) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PIECE_KINDS.map((kind) => {
        const next: Placement = { owner, kind, card: null };
        const active = placement?.card === null && placement.kind === kind;
        return (
          <DraggableSource
            key={kind}
            id={`new-kind:${kind}`}
            data={{ type: "board-new-piece", ...next }}
            onClick={() => onPick(next)}
            label={PIECE_KIND_LABEL[kind]()}
            className={cn(
              "border-input hover:bg-foreground/10 bg-foreground/5 rounded-md border px-2.5 py-1 text-sm",
              active && "bg-foreground/16 ring-ring ring-2",
            )}
          >
            {PIECE_KIND_LABEL[kind]()}
          </DraggableSource>
        );
      })}
    </div>
  );
}

function PrintingSelect({ piece, actions }: { piece: BoardPiece; actions: BoardPieceActions }) {
  const { printingsByCardId } = useCards();
  const card = piece.card;
  const printings = card ? (printingsByCardId.get(card.cardId) ?? []) : [];
  if (!card || printings.length < 2) {
    return null;
  }
  const items = printings.map((printing) => ({
    value: printing.id,
    label: formatPrintingCode(printing.publicCode),
  }));
  return (
    <Label className="flex flex-col items-stretch gap-1">
      {m.board_states_editor_printing()}
      <Select
        items={items}
        value={card.printingId ?? printings[0]?.id ?? ""}
        onValueChange={(next) => {
          if (typeof next === "string") {
            actions.setPrinting(next);
          }
        }}
      >
        <SelectTrigger className="font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
}

const SHORTCUTS: { keys: string[]; label: () => string }[] = [
  { keys: ["E"], label: m.board_states_state_exhausted },
  { keys: ["K"], label: m.board_states_editor_keyword },
  { keys: ["−", "+"], label: m.board_states_state_damage },
  { keys: ["⇧", "+"], label: m.board_states_editor_might },
  { keys: ["M"], label: m.board_states_editor_arrow_move },
  { keys: ["T"], label: m.board_states_editor_arrow_target },
  { keys: ["⌫"], label: m.board_states_editor_remove_piece },
  { keys: ["Esc"], label: m.board_states_editor_shortcut_deselect },
  { keys: ["←", "→"], label: m.board_states_editor_shortcut_step },
  { keys: ["⌘", "Z"], label: m.board_states_editor_undo },
];

function ShortcutLegend() {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
      {SHORTCUTS.map((shortcut) => (
        <div key={shortcut.label()} className="col-span-2 grid grid-cols-subgrid items-center">
          <dt>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </dt>
          <dd className="text-muted-foreground truncate text-sm">{shortcut.label()}</dd>
        </div>
      ))}
    </dl>
  );
}

function SelectedInspector({
  piece,
  players,
  playerCount,
  actions,
}: {
  piece: BoardPiece;
  players: readonly BoardPlayer[];
  playerCount: number;
  actions: BoardPieceActions;
}) {
  return (
    <RailSection title={m.board_states_editor_selected()}>
      <div className="flex items-center gap-2">
        {piece.card ? (
          <PreferredPrintingThumbnail cardId={piece.card.cardId} className="h-12" />
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{pieceName(piece)}</span>
          <span className="text-muted-foreground truncate text-sm">
            {describeZone(piece.zone, piece.owner)}
          </span>
        </span>
      </div>
      <OwnerPills
        players={players}
        playerCount={playerCount}
        value={piece.owner}
        onChange={(next) => actions.setOwner(next)}
      />
      <PrintingSelect piece={piece} actions={actions} />
      {pieceMarks(piece).keywords && (
        <Label className="flex flex-col items-stretch gap-1">
          {m.board_states_editor_label()}
          <Input
            value={piece.label ?? ""}
            maxLength={40}
            onChange={(event) => actions.setLabel(event.target.value)}
          />
        </Label>
      )}
      <ShortcutLegend />
    </RailSection>
  );
}

/** The dropped-on zone decides the owner, so the bar carries no owner choice. */
export function BoardEditorAddBar({
  owner,
  placement,
  onPlacement,
}: {
  owner: BoardPlayer;
  placement: Placement | null;
  onPlacement: (placement: Placement | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CardSearch owner={owner} placement={placement} onPick={onPlacement} />
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          <ShapesIcon />
          {m.board_states_editor_placeholder()}
          <ChevronDownIcon />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <GenericPieces owner={owner} placement={placement} onPick={onPlacement} />
        </PopoverContent>
      </Popover>
      {placement ? (
        <Badge variant="secondary" className="gap-1.5">
          {m.board_states_editor_armed({
            name: placement.card?.name ?? PIECE_KIND_LABEL[placement.kind](),
          })}
          <ChipRemoveButton
            aria-label={m.board_states_editor_clear_card()}
            onClick={() => onPlacement(null)}
          />
        </Badge>
      ) : null}
    </div>
  );
}

export function BoardEditorRail({
  players,
  playerCount,
  selectedPiece,
  actions,
}: {
  players: readonly BoardPlayer[];
  playerCount: number;
  selectedPiece: BoardPiece | null;
  actions: BoardPieceActions;
}) {
  return (
    <div className="flex flex-col gap-5">
      {selectedPiece ? (
        <SelectedInspector
          key={selectedPiece.id}
          piece={selectedPiece}
          players={players}
          playerCount={playerCount}
          actions={actions}
        />
      ) : (
        <RailSection title={m.board_states_editor_selected()}>
          <span className="text-muted-foreground text-sm">
            {m.board_states_editor_nothing_selected()}
          </span>
          <ShortcutLegend />
        </RailSection>
      )}
    </div>
  );
}
