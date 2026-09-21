import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type {
  BoardCardRef,
  BoardPiece,
  BoardPlayer,
  BoardZoneRef,
  PieceKind,
} from "@openrift/shared/board-state";
import { BOARD_PLAYERS, PIECE_KINDS } from "@openrift/shared/board-state";
import type { Card } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { useCardCandidates } from "@/features/cards/hooks/use-card-candidates";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CardPicker } from "@/features/decks/components/deck-card-picker";
import { BoardCaptionEditor } from "@/features/rules/components/board-caption-editor";
import { BoardEditorFilmstrip } from "@/features/rules/components/board-editor-filmstrip";
import type { PieceMenuAnchor } from "@/features/rules/components/board-editor-piece-actions";
import {
  BoardEditorPieceMenu,
  BoardEditorPieceToolbar,
} from "@/features/rules/components/board-editor-piece-actions";
import type { Placement } from "@/features/rules/components/board-editor-rail";
import { BoardEditorAddBar, BoardEditorRail } from "@/features/rules/components/board-editor-rail";
import { BoardEditorSetupStrip } from "@/features/rules/components/board-editor-setup-strip";
import type {
  ArrowDragData,
  PieceDragData,
  PieceDropData,
  ZoneDropData,
} from "@/features/rules/components/board-view";
import {
  BattlefieldCardFrame,
  BoardView,
  CARD_CORNER_STYLE,
  CARD_SLOT_CLASS,
  CardGhost,
  cardImage,
  describeArrow,
  describeZone,
  LANDSCAPE_CORNER_STYLE,
  pieceName,
} from "@/features/rules/components/board-view";
import { useBoardEditorPieceActions } from "@/features/rules/hooks/use-board-editor-piece-actions";
import { useBoardEditorShortcuts } from "@/features/rules/hooks/use-board-editor-shortcuts";
import type { NewPieceDragData } from "@/features/rules/lib/board-editor-drag";
import { pieceKindForCardTypes, sameZone, zoneCardRule } from "@/features/rules/lib/board-layout";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { asDragData } from "@/lib/dnd-data";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const DRAG_ACTIVATION = { distance: 8 };

const PIECE_KIND_LABEL: Record<PieceKind, () => string> = {
  unit: m.board_states_piece_unit,
  spell: m.board_states_piece_spell,
  gear: m.board_states_piece_gear,
  rune: m.board_states_piece_rune,
  legend: m.board_states_piece_legend,
  token: m.board_states_piece_token,
};

type ArrowMode = { kind: "move" | "target"; from: string } | null;

const isBattlefield = (card: Card) => card.types.includes("battlefield");

/** Module-level so `useCardCandidates` gets identity-stable predicates. */
const ZONE_FILTERS: Partial<Record<BoardZoneRef["kind"], (card: Card) => boolean>> = {
  runes: zoneCardRule({ kind: "runes" })?.cardFilter,
  legend: zoneCardRule({ kind: "legend" })?.cardFilter,
  champion: zoneCardRule({ kind: "champion" })?.cardFilter,
};

function toCardRef(cardId: string, card: Card): BoardCardRef {
  return { cardId, name: legendDisplayName(card) };
}

export interface EditorMeta {
  title: string;
  answer: string;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs uppercase">{title}</h2>
      {children}
    </section>
  );
}

function BattlefieldCardPicker({ index, onDone }: { index: number; onDone: () => void }) {
  const setBattlefieldCard = useBoardEditorStore((state) => state.setBattlefieldCard);
  const { candidates, cardsById } = useCardCandidates(isBattlefield);
  return (
    <CardPicker
      candidates={candidates}
      listAllWhenEmpty
      placeholder={m.board_states_editor_battlefield_card()}
      onSelect={(cardId) => {
        const card = cardsById[cardId];
        if (card) {
          setBattlefieldCard(index, toCardRef(cardId, card));
          onDone();
        }
      }}
    />
  );
}

function BattlefieldCardPopover({
  index,
  cardName,
  image,
}: {
  index: number;
  cardName: string | null;
  image?: string;
}) {
  const [open, setOpen] = useState(false);
  const setBattlefieldCard = useBoardEditorStore((state) => state.setBattlefieldCard);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Pressable
            className="hover:ring-2 hover:ring-white/60"
            style={LANDSCAPE_CORNER_STYLE}
            aria-label={m.board_states_editor_battlefield_card()}
          />
        }
      >
        <BattlefieldCardFrame index={index} cardName={cardName} image={image} />
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <BattlefieldCardPicker index={index} onDone={() => setOpen(false)} />
        {cardName ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBattlefieldCard(index, null);
              setOpen(false);
            }}
          >
            <XIcon />
            {m.board_states_editor_clear_card()}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function ZoneAddPanel({
  zone,
  owner,
  label,
  onDone,
}: {
  zone: BoardZoneRef;
  owner: BoardPlayer;
  label: string;
  onDone: () => void;
}) {
  const addPiece = useBoardEditorStore((state) => state.addPiece);
  const removePiece = useBoardEditorStore((state) => state.removePiece);
  const stepPieces = useBoardEditorStore((state) => state.document.steps[state.activeStep]?.pieces);
  const zonePieces = (stepPieces ?? []).filter(
    (piece) => sameZone(piece.zone, zone) && piece.owner === owner,
  );
  const rule = zoneCardRule(zone);
  const { candidates, cardsById } = useCardCandidates(ZONE_FILTERS[zone.kind]);
  const catalog = useCards();
  const place = (kind: PieceKind, card: BoardCardRef | null) => {
    addPiece({ owner, zone, kind, card });
    onDone();
  };
  if (zone.kind === "runes") {
    const tiles = [
      ...candidates.map(({ cardId, cardName }) => {
        const card = cardsById[cardId];
        return {
          key: cardId,
          name: cardName,
          image: card ? cardImage({ cardId, name: cardName }, catalog) : undefined,
          card: card ? toCardRef(cardId, card) : null,
        };
      }),
      { key: "generic", name: PIECE_KIND_LABEL.rune(), image: undefined, card: null },
    ];
    return (
      <>
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex flex-wrap gap-2">
          {tiles.map((tile) => (
            <RuneTile
              key={tile.key}
              name={tile.name}
              image={tile.image}
              count={
                zonePieces.filter(
                  (piece) => (piece.card?.cardId ?? null) === (tile.card?.cardId ?? null),
                ).length
              }
              onAdd={() => addPiece({ owner, zone, kind: "rune", card: tile.card })}
              onRemove={() => {
                const last = zonePieces.findLast(
                  (piece) => (piece.card?.cardId ?? null) === (tile.card?.cardId ?? null),
                );
                if (last) {
                  removePiece(last.id);
                }
              }}
            />
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <span className="text-sm font-semibold">{label}</span>
      <CardPicker
        candidates={candidates}
        listAllWhenEmpty={false}
        placeholder={m.board_states_editor_search_cards()}
        onSelect={(cardId) => {
          const card = cardsById[cardId];
          if (card) {
            place(pieceKindForCardTypes(card.types), toCardRef(cardId, card));
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {(rule?.kinds ?? PIECE_KINDS).map((kind) => (
          <Button key={kind} size="sm" variant="outline" onClick={() => place(kind, null)}>
            {PIECE_KIND_LABEL[kind]()}
          </Button>
        ))}
      </div>
    </>
  );
}

function RuneTile({
  name,
  image,
  count,
  onAdd,
  onRemove,
}: {
  name: string;
  image: string | undefined;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="relative flex flex-col items-center gap-1">
      <Pressable
        className={cn(CARD_SLOT_CLASS, "overflow-hidden", image !== undefined && "border-solid")}
        style={CARD_CORNER_STYLE}
        aria-label={name}
        title={name}
        onClick={onAdd}
      >
        {image === undefined ? (
          <span className="font-card text-2xs p-0.5 text-center leading-tight">{name}</span>
        ) : (
          <img src={image} alt="" className="size-full object-cover" />
        )}
      </Pressable>
      {count > 0 && (
        <>
          <span className="pointer-events-none absolute top-[2.45rem] left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-sm font-bold text-white ring-2 ring-white/80 sm:top-[2.45rem]">
            {count}
          </span>
          <ChipRemoveButton
            aria-label={m.board_states_editor_remove_piece()}
            className="text-muted-foreground"
            onClick={onRemove}
          >
            <MinusIcon className="size-3.5" />
          </ChipRemoveButton>
        </>
      )}
    </span>
  );
}

function ZoneAddPopover({ zone, owner }: { zone: BoardZoneRef; owner: BoardPlayer }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Element | null>(null);
  const label = `${m.board_states_editor_place()}: ${describeZone(zone, owner)}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Pressable
            className={CARD_SLOT_CLASS}
            style={CARD_CORNER_STYLE}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              setAnchor(event.currentTarget.closest("[data-board-zone]"));
            }}
          />
        }
      >
        <PlusIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        anchor={anchor ?? undefined}
        align="start"
        className="flex w-72 flex-col gap-2"
      >
        <ZoneAddPanel zone={zone} owner={owner} label={label} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export function BoardWorkspace() {
  const document = useBoardEditorStore((state) => state.document);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectedPieceId = useBoardEditorStore((state) => state.selectedPieceId);
  const selectedPieceIds = useBoardEditorStore((state) => state.selectedPieceIds);
  const toggleSelectPiece = useBoardEditorStore((state) => state.toggleSelectPiece);
  const selectPieces = useBoardEditorStore((state) => state.selectPieces);
  const addArrow = useBoardEditorStore((state) => state.addArrow);
  const removeArrow = useBoardEditorStore((state) => state.removeArrow);
  const removeChainEntry = useBoardEditorStore((state) => state.removeChainEntry);
  const addPiece = useBoardEditorStore((state) => state.addPiece);
  const movePiece = useBoardEditorStore((state) => state.movePiece);
  const selectPiece = useBoardEditorStore((state) => state.selectPiece);
  const selectStep = useBoardEditorStore((state) => state.selectStep);
  const setCaption = useBoardEditorStore((state) => state.setCaption);
  const undo = useBoardEditorStore((state) => state.undo);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const owner: BoardPlayer = "A";
  const [arrowMode, setArrowMode] = useState<ArrowMode>(null);
  const [keywordOpen, setKeywordOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<PieceMenuAnchor | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    name: string;
    owner: BoardPlayer;
    card: BoardCardRef | null;
  } | null>(null);
  const catalog = useCards();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: DRAG_ACTIVATION }));
  const players = BOARD_PLAYERS.slice(0, document.playerCount);
  const step = document.steps[activeStep];
  const pieces = step?.pieces ?? [];
  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId) ?? null;
  const selectedPieces = selectedPieceIds.flatMap((id) =>
    pieces.filter((piece) => piece.id === id),
  );
  const menuPiece = pieces.find((piece) => piece.id === menuAnchor?.pieceId) ?? null;
  const actions = useBoardEditorPieceActions(selectedPieces);
  const menuActions = useBoardEditorPieceActions(
    menuPiece && !selectedPieceIds.includes(menuPiece.id) ? [menuPiece] : selectedPieces,
  );

  const startArrow = (kind: "move" | "target") => {
    if (selectedPiece) {
      setArrowMode({ kind, from: selectedPiece.id });
    }
  };

  useBoardEditorShortcuts({
    hasSelection: selectedPiece !== null,
    onExhaust: actions.toggleExhaust,
    onKeyword: () => setKeywordOpen(true),
    onDamage: actions.adjustDamage,
    onMight: actions.adjustMight,
    onArrow: startArrow,
    onRemove: actions.remove,
    onEscape: () => {
      if (arrowMode) {
        setArrowMode(null);
        return;
      }
      setPlacement(null);
      selectPiece(null);
    },
    onUndo: undo,
    onStep: (delta) => selectStep(activeStep + delta),
  });

  if (!step) {
    return null;
  }

  const handleZoneClick = (zone: BoardZoneRef, clicked: BoardPlayer) => {
    if (arrowMode?.kind === "move") {
      addArrow({ kind: "move", from: arrowMode.from, to: { zone, owner: clicked } });
      setArrowMode(null);
      return;
    }
    if (placement) {
      addPiece({ ...placement, owner: clicked, zone });
      return;
    }
    setKeywordOpen(false);
    selectPiece(null);
  };

  const handlePieceClick = (piece: BoardPiece, event: React.MouseEvent) => {
    if (arrowMode) {
      if (piece.id !== arrowMode.from) {
        addArrow({ kind: arrowMode.kind, from: arrowMode.from, to: { piece: piece.id } });
      }
      setArrowMode(null);
      return;
    }
    setPlacement(null);
    setKeywordOpen(false);
    if (event.ctrlKey || event.metaKey) {
      toggleSelectPiece(piece.id);
      return;
    }
    if (event.shiftKey && selectedPiece && selectedPiece.id !== piece.id) {
      const row = pieces.filter(
        (entry) => sameZone(entry.zone, selectedPiece.zone) && entry.owner === selectedPiece.owner,
      );
      const from = row.findIndex((entry) => entry.id === selectedPiece.id);
      const to = row.findIndex((entry) => entry.id === piece.id);
      if (from !== -1 && to !== -1) {
        const range = row
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((entry) => entry.id);
        selectPieces(from <= to ? range : range.toReversed());
        return;
      }
    }
    selectPiece(piece.id === selectedPieceId && selectedPieceIds.length === 1 ? null : piece.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const over = event.over?.data.current;
    const zone = asDragData<ZoneDropData>(over, ["board-zone"]);
    const pieceTarget = asDragData<PieceDropData>(over, ["board-piece-target"]);
    const arrow = asDragData<ArrowDragData>(event.active.data.current, ["board-arrow"]);
    if (arrow) {
      if (pieceTarget && pieceTarget.pieceId !== arrow.from) {
        addArrow({ kind: "target", from: arrow.from, to: { piece: pieceTarget.pieceId } });
      } else if (zone) {
        addArrow({ kind: "move", from: arrow.from, to: { zone: zone.zone, owner: zone.owner } });
      }
      return;
    }
    if (!zone) {
      return;
    }
    const created = asDragData<NewPieceDragData>(event.active.data.current, ["board-new-piece"]);
    if (created) {
      addPiece({
        owner: zone.owner,
        zone: zone.zone,
        kind: created.kind,
        card: created.card,
      });
      return;
    }
    const dragged = asDragData<PieceDragData>(event.active.data.current, ["board-piece"]);
    if (dragged) {
      movePiece(dragged.pieceId, zone.zone, zone.owner);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const created = asDragData<NewPieceDragData>(event.active.data.current, ["board-new-piece"]);
    if (created) {
      setDragGhost({
        name: created.card?.name ?? PIECE_KIND_LABEL[created.kind](),
        owner: created.owner,
        card: created.card,
      });
      return;
    }
    const dragged = asDragData<PieceDragData>(event.active.data.current, ["board-piece"]);
    const piece = dragged ? pieces.find((entry) => entry.id === dragged.pieceId) : undefined;
    setDragGhost(piece ? { name: pieceName(piece), owner: piece.owner, card: piece.card } : null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={(event) => {
        setDragGhost(null);
        handleDragEnd(event);
      }}
      onDragCancel={() => setDragGhost(null)}
    >
      <DragOverlay dropAnimation={null}>
        {dragGhost ? (
          <CardGhost
            name={dragGhost.name}
            owner={dragGhost.owner}
            image={dragGhost.card ? cardImage(dragGhost.card, catalog) : undefined}
          />
        ) : null}
      </DragOverlay>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <BoardEditorSetupStrip />
          <BoardEditorAddBar
            owner={owner}
            placement={placement}
            onPlacement={(next) => {
              setPlacement(next);
              selectPiece(null);
            }}
          />
        </div>
        <BoardView
          document={document}
          step={step}
          selectedPieceId={selectedPieceId}
          selectedPieceIds={selectedPieceIds}
          zonesArmed={placement !== null}
          onPieceClick={handlePieceClick}
          onZoneClick={handleZoneClick}
          onPieceContextMenu={(piece, event) => {
            event.preventDefault();
            selectPiece(piece.id);
            setMenuAnchor({ pieceId: piece.id, x: event.clientX, y: event.clientY });
          }}
          draggable
          arrowHandle
          renderZoneAdd={(zone, zoneOwner) => <ZoneAddPopover zone={zone} owner={zoneOwner} />}
          renderChainAdd={() => <ChainAddPopover players={players} />}
          onChainEntryRemove={removeChainEntry}
          renderBattlefieldCard={(index, cardName, image) => (
            <BattlefieldCardPopover index={index} cardName={cardName} image={image} />
          )}
          renderPieceOverlay={(piece) =>
            piece.id === selectedPieceId ? (
              <BoardEditorPieceToolbar
                piece={piece}
                actions={actions}
                keywordOpen={keywordOpen}
                onKeywordOpenChange={setKeywordOpen}
                onArrow={startArrow}
                onDismiss={() => selectPiece(null)}
              />
            ) : null
          }
        />
        {arrowMode ? (
          <p className="flex items-center gap-2 text-sm">
            {m.board_states_editor_arrow_hint()}
            <Button size="sm" variant="ghost" onClick={() => setArrowMode(null)}>
              <XIcon />
            </Button>
          </p>
        ) : null}
        {step.arrows.length > 0 && (
          <Section title={m.board_states_editor_arrows()}>
            {step.arrows.map((entry, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- arrows are positional
              <span key={index} className="flex items-center gap-2 text-sm">
                {describeArrow(entry, step)}
                <ChipRemoveButton
                  aria-label={m.board_states_editor_remove_arrow()}
                  onClick={() => removeArrow(index)}
                >
                  <XIcon className="size-3.5" />
                </ChipRemoveButton>
              </span>
            ))}
          </Section>
        )}
      </div>
      <BoardEditorRail
        players={players}
        playerCount={document.playerCount}
        selectedPiece={selectedPiece}
        actions={actions}
      />
      <div className="flex flex-col gap-3 lg:col-span-2">
        <BoardEditorFilmstrip />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-caption">{m.board_states_editor_caption()}</Label>
          <BoardCaptionEditor
            id="board-caption"
            value={step.caption}
            onChange={setCaption}
            pieces={step.pieces}
            maxLength={2000}
          />
          <span className="text-muted-foreground text-sm">
            {m.board_states_editor_caption_refs()}
          </span>
        </div>
      </div>
      {menuAnchor && menuPiece ? (
        <BoardEditorPieceMenu
          anchor={menuAnchor}
          piece={menuPiece}
          actions={menuActions}
          onClose={() => setMenuAnchor(null)}
          onArrow={(kind) => setArrowMode({ kind, from: menuAnchor.pieceId })}
          onKeyword={() => setKeywordOpen(true)}
        />
      ) : null}
    </DndContext>
  );
}

function ChainAddPopover({ players }: { players: readonly BoardPlayer[] }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<BoardPlayer>("A");
  const addChainEntry = useBoardEditorStore((state) => state.addChainEntry);
  const { candidates, cardsById } = useCardCandidates();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Pressable
            className={CARD_SLOT_CLASS}
            style={CARD_CORNER_STYLE}
            aria-label={m.board_states_editor_chain_add()}
          />
        }
      >
        <PlusIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <span className="text-sm font-semibold">{m.board_states_editor_chain_add()}</span>
        <div className="flex gap-1.5">
          {players.map((player) => (
            <Button
              key={player}
              size="sm"
              variant={player === owner ? "default" : "outline"}
              onClick={() => setOwner(player)}
            >
              {player}
            </Button>
          ))}
        </div>
        <CardPicker
          candidates={candidates}
          listAllWhenEmpty={false}
          placeholder={m.board_states_editor_search_cards()}
          onSelect={(cardId) => {
            const card = cardsById[cardId];
            if (card) {
              addChainEntry({ owner, card: toCardRef(cardId, card) });
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
