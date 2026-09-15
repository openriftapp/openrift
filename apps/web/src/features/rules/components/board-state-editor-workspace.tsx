import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type {
  BoardCardRef,
  BoardPiece,
  BoardPlayer,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  RuleRefKind,
} from "@openrift/shared/board-state";
import { BOARD_PLAYERS, MAX_BATTLEFIELDS, PIECE_KINDS } from "@openrift/shared/board-state";
import type { Card } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CardPicker } from "@/features/decks/components/deck-card-picker";
import type { PieceDragData, ZoneDropData } from "@/features/rules/components/board-view";
import {
  BoardView,
  describeArrow,
  describeZone,
  PLAYER_COLOR,
  pieceName,
} from "@/features/rules/components/board-view";
import { pieceKindForCardTypes } from "@/features/rules/lib/board-layout";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { asDragData } from "@/lib/dnd-data";
import { m } from "@/paraglide/messages.js";

const ZONE_TOGGLES: { key: keyof BoardZoneVisibility; label: () => string }[] = [
  { key: "legend", label: m.board_states_zone_legend },
  { key: "champion", label: m.board_states_zone_champion },
  { key: "base", label: m.board_states_zone_base },
  { key: "runes", label: m.board_states_zone_runes },
  { key: "hand", label: m.board_states_zone_hand },
  { key: "trash", label: m.board_states_zone_trash },
  { key: "chain", label: m.board_states_chain },
];

const PIECE_KIND_LABEL: Record<PieceKind, () => string> = {
  unit: m.board_states_piece_unit,
  spell: m.board_states_piece_spell,
  gear: m.board_states_piece_gear,
  rune: m.board_states_piece_rune,
  legend: m.board_states_piece_legend,
  token: m.board_states_piece_token,
};

const DRAG_ACTIVATION = { distance: 8 };

interface Placement {
  owner: BoardPlayer;
  kind: PieceKind;
  card: BoardCardRef | null;
}

type ArrowMode = { kind: "move" | "target"; from: string } | null;

interface CardCandidate {
  cardId: string;
  cardName: string;
}

function toCardRef(cardId: string, card: Card): BoardCardRef {
  return { cardId, name: legendDisplayName(card) };
}

export interface EditorMeta {
  title: string;
  answer: string;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs uppercase">{title}</h2>
      {children}
    </section>
  );
}

function RulesPinField({
  kind,
  label,
  value,
  onChange,
}: {
  kind: RuleRefKind;
  label: string;
  value: string | null;
  onChange: (version: string | null) => void;
}) {
  const versions = useQuery(ruleVersionsQueryOptions(kind)).data?.versions ?? [];
  const latest = versions.at(-1)?.version ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center justify-between gap-2">
        {label}
        <Switch
          checked={value !== null}
          disabled={latest === null}
          onCheckedChange={(checked) => onChange(checked ? latest : null)}
        />
      </Label>
      {value === null ? null : (
        <Select
          value={value}
          onValueChange={(next) => {
            if (typeof next === "string") {
              onChange(next);
            }
          }}
        >
          <SelectTrigger className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.toReversed().map((entry) => (
              <SelectItem key={entry.version} value={entry.version}>
                {entry.version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function SetupPane({
  meta,
  onMeta,
}: {
  meta: EditorMeta;
  onMeta: (meta: EditorMeta) => void;
}) {
  const playerCount = useBoardEditorStore((state) => state.document.playerCount);
  const battlefieldCount = useBoardEditorStore((state) => state.document.battlefields.length);
  const zones = useBoardEditorStore((state) => state.document.zones);
  const setPlayerCount = useBoardEditorStore((state) => state.setPlayerCount);
  const setBattlefieldCount = useBoardEditorStore((state) => state.setBattlefieldCount);
  const setZoneVisible = useBoardEditorStore((state) => state.setZoneVisible);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-title">{m.board_states_editor_question()}</Label>
        <Input
          id="board-title"
          value={meta.title}
          maxLength={200}
          onChange={(event) => onMeta({ ...meta, title: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="board-answer">{m.board_states_editor_answer()}</Label>
        <Textarea
          id="board-answer"
          value={meta.answer}
          maxLength={2000}
          onChange={(event) => onMeta({ ...meta, answer: event.target.value })}
        />
      </div>
      <Section title={m.board_states_editor_rules_version()}>
        <RulesPinField
          kind="core"
          label={m.board_states_editor_core_rules()}
          value={meta.coreRulesVersion}
          onChange={(coreRulesVersion) => onMeta({ ...meta, coreRulesVersion })}
        />
        <RulesPinField
          kind="tournament"
          label={m.board_states_editor_tournament_rules()}
          value={meta.tournamentRulesVersion}
          onChange={(tournamentRulesVersion) => onMeta({ ...meta, tournamentRulesVersion })}
        />
      </Section>
      <Section title={m.board_states_editor_players()}>
        <div className="flex gap-2">
          {[2, 3, 4].map((count) => (
            <Button
              key={count}
              size="sm"
              variant={count === playerCount ? "default" : "outline"}
              onClick={() => setPlayerCount(count)}
            >
              {count}
            </Button>
          ))}
        </div>
      </Section>
      <Section title={m.board_states_editor_battlefields()}>
        <div className="flex gap-2">
          {Array.from({ length: MAX_BATTLEFIELDS + 1 }, (_, count) => (
            <Button
              key={count}
              size="sm"
              variant={count === battlefieldCount ? "default" : "outline"}
              onClick={() => setBattlefieldCount(count)}
            >
              {count}
            </Button>
          ))}
        </div>
      </Section>
      <Section title={m.board_states_editor_zones()}>
        {ZONE_TOGGLES.map((toggle) => (
          <Label key={toggle.key} className="flex items-center justify-between gap-2">
            {toggle.label()}
            <Switch
              checked={zones[toggle.key]}
              onCheckedChange={(checked) => setZoneVisible(toggle.key, checked)}
            />
          </Label>
        ))}
      </Section>
    </div>
  );
}

function useCardCandidates(): {
  all: CardCandidate[];
  battlefields: CardCandidate[];
  byId: Record<string, Card>;
} {
  const { cardsById } = useCards();
  const entries = Object.entries(cardsById);
  const toCandidate = ([cardId, card]: [string, Card]) => ({
    cardId,
    cardName: legendDisplayName(card),
  });
  return {
    all: entries.map((entry) => toCandidate(entry)),
    battlefields: entries
      .filter(([, card]) => card.types.includes("battlefield"))
      .map((entry) => toCandidate(entry)),
    byId: cardsById,
  };
}

function BattlefieldCardPopover({ index, cardName }: { index: number; cardName: string | null }) {
  const [open, setOpen] = useState(false);
  const setBattlefieldCard = useBoardEditorStore((state) => state.setBattlefieldCard);
  const candidates = useCardCandidates();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-border-accent bg-secondary w-full justify-center text-xs font-semibold"
          />
        }
      >
        {cardName ?? m.board_states_battlefield({ number: index + 1 })}
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <CardPicker
          candidates={candidates.battlefields}
          listAllWhenEmpty
          placeholder={m.board_states_editor_battlefield_card()}
          onSelect={(cardId) => {
            const card = candidates.byId[cardId];
            if (card) {
              setBattlefieldCard(index, toCardRef(cardId, card));
              setOpen(false);
            }
          }}
        />
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

function ZoneAddPopover({ zone, owner }: { zone: BoardZoneRef; owner: BoardPlayer }) {
  const [open, setOpen] = useState(false);
  const addPiece = useBoardEditorStore((state) => state.addPiece);
  const candidates = useCardCandidates();
  const label = `${m.board_states_editor_place()}: ${describeZone(zone, owner)}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="size-5" aria-label={label} />}
      >
        <PlusIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <CardPicker
          candidates={candidates.all}
          listAllWhenEmpty={false}
          placeholder={m.board_states_editor_search_cards()}
          onSelect={(cardId) => {
            const card = candidates.byId[cardId];
            if (card) {
              addPiece({
                owner,
                zone,
                kind: pieceKindForCardTypes(card.types),
                card: toCardRef(cardId, card),
              });
              setOpen(false);
            }
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {PIECE_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              onClick={() => {
                addPiece({ owner, zone, kind, card: null });
                setOpen(false);
              }}
            >
              {PIECE_KIND_LABEL[kind]()}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BoardWorkspace() {
  const document = useBoardEditorStore((state) => state.document);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectedPieceId = useBoardEditorStore((state) => state.selectedPieceId);
  const addArrow = useBoardEditorStore((state) => state.addArrow);
  const removeArrow = useBoardEditorStore((state) => state.removeArrow);
  const addPiece = useBoardEditorStore((state) => state.addPiece);
  const movePiece = useBoardEditorStore((state) => state.movePiece);
  const selectPiece = useBoardEditorStore((state) => state.selectPiece);
  const setCaption = useBoardEditorStore((state) => state.setCaption);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [arrowMode, setArrowMode] = useState<ArrowMode>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: DRAG_ACTIVATION }));
  const players = BOARD_PLAYERS.slice(0, document.playerCount);
  const step = document.steps[activeStep];
  if (!step) {
    return null;
  }
  const selectedPiece = step.pieces.find((piece) => piece.id === selectedPieceId) ?? null;

  const handleZoneClick = (zone: BoardZoneRef, owner: BoardPlayer) => {
    if (arrowMode?.kind === "move") {
      addArrow({ kind: "move", from: arrowMode.from, to: { zone, owner } });
      setArrowMode(null);
      return;
    }
    if (placement) {
      addPiece({ ...placement, owner, zone });
      return;
    }
    if (selectedPiece) {
      movePiece(selectedPiece.id, zone, owner);
    }
  };

  const handlePieceClick = (piece: BoardPiece) => {
    if (arrowMode) {
      if (piece.id !== arrowMode.from) {
        addArrow({ kind: arrowMode.kind, from: arrowMode.from, to: { piece: piece.id } });
      }
      setArrowMode(null);
      return;
    }
    setPlacement(null);
    selectPiece(piece.id === selectedPieceId ? null : piece.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const dragged = asDragData<PieceDragData>(event.active.data.current, ["board-piece"]);
    const target = asDragData<ZoneDropData>(event.over?.data.current, ["board-zone"]);
    if (dragged && target) {
      movePiece(dragged.pieceId, target.zone, target.owner);
    }
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3">
        <StepStrip />
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <BoardView
            document={document}
            step={step}
            selectedPieceId={selectedPieceId}
            onPieceClick={handlePieceClick}
            onZoneClick={handleZoneClick}
            draggable
            renderZoneAdd={(zone, owner) => <ZoneAddPopover zone={zone} owner={owner} />}
            renderBattlefieldCard={(index, cardName) => (
              <BattlefieldCardPopover index={index} cardName={cardName} />
            )}
          />
        </DndContext>
        {arrowMode ? (
          <p className="flex items-center gap-2 text-sm">
            {m.board_states_editor_arrow_hint()}
            <Button size="sm" variant="ghost" onClick={() => setArrowMode(null)}>
              <XIcon />
            </Button>
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-caption">{m.board_states_editor_caption()}</Label>
          <Textarea
            id="board-caption"
            value={step.caption}
            maxLength={2000}
            onChange={(event) => setCaption(event.target.value)}
          />
          <span className="text-muted-foreground text-sm">
            {m.board_states_editor_caption_hint()}
          </span>
        </div>
        {step.arrows.length > 0 && (
          <Section title={m.board_states_editor_arrows()}>
            {step.arrows.map((arrow, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- arrows are positional
              <span key={index} className="flex items-center gap-2 text-sm">
                {describeArrow(arrow, step)}
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
        {document.zones.chain && <ChainEditor players={players} />}
      </div>
      <div className="flex flex-col gap-5">
        <PlacementPane
          players={players}
          placement={placement}
          onPlacement={(next) => {
            setPlacement(next);
            selectPiece(null);
          }}
        />
        {selectedPiece ? (
          <PieceInspector
            key={selectedPiece.id}
            piece={selectedPiece}
            players={players}
            onArrow={(kind) => setArrowMode({ kind, from: selectedPiece.id })}
          />
        ) : null}
      </div>
    </>
  );
}

function StepStrip() {
  const count = useBoardEditorStore((state) => state.document.steps.length);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectStep = useBoardEditorStore((state) => state.selectStep);
  const addStep = useBoardEditorStore((state) => state.addStep);
  const removeStep = useBoardEditorStore((state) => state.removeStep);
  const moveStep = useBoardEditorStore((state) => state.moveStep);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Button
          key={index}
          size="sm"
          variant={index === activeStep ? "default" : "outline"}
          onClick={() => selectStep(index)}
        >
          {index + 1}
        </Button>
      ))}
      <Button size="sm" variant="outline" onClick={addStep}>
        <PlusIcon />
        {m.board_states_editor_add_step()}
      </Button>
      <span className="flex-1" />
      <Button
        size="sm"
        variant="ghost"
        disabled={activeStep === 0}
        aria-label={m.board_states_editor_move_step_left()}
        onClick={() => moveStep(activeStep, activeStep - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={activeStep >= count - 1}
        aria-label={m.board_states_editor_move_step_right()}
        onClick={() => moveStep(activeStep, activeStep + 1)}
      >
        <ChevronRightIcon />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={count <= 1}
        onClick={() => removeStep(activeStep)}
      >
        <Trash2Icon />
        {m.board_states_editor_remove_step()}
      </Button>
    </div>
  );
}

function OwnerButtons({
  players,
  value,
  onChange,
}: {
  players: readonly BoardPlayer[];
  value: BoardPlayer;
  onChange: (player: BoardPlayer) => void;
}) {
  return (
    <div className="flex gap-2">
      {players.map((player) => (
        <Button
          key={player}
          size="sm"
          variant={player === value ? "default" : "outline"}
          style={player === value ? { backgroundColor: PLAYER_COLOR[player] } : undefined}
          onClick={() => onChange(player)}
        >
          {player}
        </Button>
      ))}
    </div>
  );
}

function PlacementPane({
  players,
  placement,
  onPlacement,
}: {
  players: readonly BoardPlayer[];
  placement: Placement | null;
  onPlacement: (placement: Placement | null) => void;
}) {
  const candidates = useCardCandidates();
  const owner = placement?.owner ?? "A";
  return (
    <Section title={m.board_states_editor_place()}>
      <span className="text-muted-foreground text-sm">{m.board_states_editor_place_hint()}</span>
      <OwnerButtons
        players={players}
        value={owner}
        onChange={(next) =>
          onPlacement({
            owner: next,
            kind: placement?.kind ?? "unit",
            card: placement?.card ?? null,
          })
        }
      />
      <CardPicker
        candidates={candidates.all}
        listAllWhenEmpty={false}
        placeholder={m.board_states_editor_search_cards()}
        onSelect={(cardId) => {
          const card = candidates.byId[cardId];
          if (card) {
            onPlacement({
              owner,
              kind: pieceKindForCardTypes(card.types),
              card: toCardRef(cardId, card),
            });
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {PIECE_KINDS.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={placement?.card === null && placement.kind === kind ? "default" : "outline"}
            onClick={() => onPlacement({ owner, kind, card: null })}
          >
            {PIECE_KIND_LABEL[kind]()}
          </Button>
        ))}
      </div>
      {placement ? (
        <span className="bg-muted flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm">
          <span className="truncate">
            {placement.owner}: {placement.card?.name ?? PIECE_KIND_LABEL[placement.kind]()}
          </span>
          <ChipRemoveButton
            aria-label={m.board_states_editor_clear_card()}
            onClick={() => onPlacement(null)}
          >
            <XIcon className="size-3.5" />
          </ChipRemoveButton>
        </span>
      ) : null}
    </Section>
  );
}

function PieceInspector({
  piece,
  players,
  onArrow,
}: {
  piece: BoardPiece;
  players: readonly BoardPlayer[];
  onArrow: (kind: "move" | "target") => void;
}) {
  const updatePiece = useBoardEditorStore((state) => state.updatePiece);
  const removePiece = useBoardEditorStore((state) => state.removePiece);
  const toggles = [
    { key: "exhausted", label: m.board_states_state_exhausted() },
    { key: "stunned", label: m.board_states_state_stunned() },
    { key: "highlight", label: m.board_states_state_highlight() },
  ] as const;
  const counters = [
    { key: "damage", label: m.board_states_state_damage() },
    { key: "buff", label: m.board_states_state_buff() },
  ] as const;
  return (
    <Section title={pieceName(piece)}>
      <OwnerButtons
        players={players}
        value={piece.owner}
        onChange={(owner) => updatePiece(piece.id, { owner })}
      />
      {toggles.map((toggle) => (
        <Label key={toggle.key} className="flex items-center justify-between gap-2">
          {toggle.label}
          <Switch
            checked={piece[toggle.key]}
            onCheckedChange={(checked) => updatePiece(piece.id, { [toggle.key]: checked })}
          />
        </Label>
      ))}
      {counters.map((counter) => (
        <Label key={counter.key} className="flex items-center justify-between gap-2">
          {counter.label}
          <Input
            type="number"
            min={0}
            max={99}
            className="w-20"
            value={piece[counter.key]}
            onChange={(event) =>
              updatePiece(piece.id, {
                [counter.key]: Math.min(99, Math.max(0, Number(event.target.value) || 0)),
              })
            }
          />
        </Label>
      ))}
      <Label className="flex flex-col items-stretch gap-1">
        {m.board_states_editor_label()}
        <Input
          value={piece.label ?? ""}
          maxLength={40}
          onChange={(event) =>
            updatePiece(piece.id, {
              label: event.target.value === "" ? undefined : event.target.value,
            })
          }
        />
      </Label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onArrow("move")}>
          <ArrowRightIcon />
          {m.board_states_editor_arrow_move()}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onArrow("target")}>
          <ArrowLeftIcon />
          {m.board_states_editor_arrow_target()}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => removePiece(piece.id)}>
          <Trash2Icon />
          {m.board_states_editor_remove_piece()}
        </Button>
      </div>
    </Section>
  );
}

function ChainEditor({ players }: { players: readonly BoardPlayer[] }) {
  const chain = useBoardEditorStore((state) => state.document.steps[state.activeStep]?.chain);
  const addChainEntry = useBoardEditorStore((state) => state.addChainEntry);
  const removeChainEntry = useBoardEditorStore((state) => state.removeChainEntry);
  const [owner, setOwner] = useState<BoardPlayer>("A");
  const [text, setText] = useState("");
  return (
    <Section title={m.board_states_chain()}>
      {(chain ?? []).map((entry, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- chain entries are positional
        <span key={index} className="flex items-center gap-2 text-sm">
          {entry.owner}: {entry.text}
          <ChipRemoveButton
            aria-label={m.board_states_editor_remove_chain()}
            onClick={() => removeChainEntry(index)}
          >
            <XIcon className="size-3.5" />
          </ChipRemoveButton>
        </span>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <OwnerButtons players={players} value={owner} onChange={setOwner} />
        <Input
          className="w-56"
          value={text}
          maxLength={200}
          placeholder={m.board_states_editor_chain_text()}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={text.trim() === ""}
          onClick={() => {
            addChainEntry({ owner, text: text.trim(), card: null });
            setText("");
          }}
        >
          {m.board_states_editor_chain_add()}
        </Button>
      </div>
    </Section>
  );
}
