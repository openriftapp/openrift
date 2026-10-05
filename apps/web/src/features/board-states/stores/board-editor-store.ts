import type {
  BoardArrow,
  BoardBattlefieldState,
  BoardCardRef,
  BoardChainEntry,
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardPlayerStats,
  BoardStep,
  BoardTurn,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  ScoringMode,
} from "@openrift/shared/board-state";
import {
  BOARD_PLAYERS,
  emptyBattlefieldState,
  emptyBoardDocument,
  MAX_BATTLEFIELDS,
  MAX_BOARD_STEPS,
  MAX_CHAIN_ENTRIES,
  MAX_PIECE_BUFFS,
  MAX_PIECE_KEYWORDS,
  zoneBattlefieldIndex,
} from "@openrift/shared/board-state";
import { create } from "zustand";

import { isHiddenZone, nextChainId, nextPieceId } from "@/features/board-states/lib/board-layout";

const HISTORY_LIMIT = 50;
const RECENT_LIMIT = 8;

interface BoardEditorState {
  document: BoardDocument;
  activeStep: number;
  selectedPieceId: string | null;
  /** Ctrl-click and shift-range selection; `selectedPieceId` is always its last entry. */
  selectedPieceIds: string[];
  dirty: boolean;
  history: BoardDocument[];
  /** Consecutive edits sharing a tag collapse into one undo step. */
  historyTag: string | null;
  /** Newest first; outside the document and the undo history. */
  recentCardIds: string[];

  undo: () => void;
  load: (document: BoardDocument) => void;
  setPlayerCount: (count: number) => void;
  setScoring: (scoring: ScoringMode) => void;
  setBattlefieldCount: (count: number) => void;
  setBattlefieldCard: (index: number, card: BoardCardRef | null) => void;
  setZoneVisible: (zone: keyof BoardZoneVisibility, visible: boolean) => void;

  selectStep: (index: number) => void;
  addStep: () => void;
  removeStep: (index: number) => void;
  moveStep: (from: number, to: number) => void;
  setCaption: (caption: string) => void;
  setTurn: (patch: Partial<BoardTurn>) => void;
  setPlayerStats: (player: BoardPlayer, patch: Partial<BoardPlayerStats>) => void;
  setBattlefieldState: (index: number, patch: Partial<BoardBattlefieldState>) => void;

  addPiece: (input: {
    owner: BoardPlayer;
    zone: BoardZoneRef;
    kind: PieceKind;
    card: BoardCardRef | null;
  }) => string;
  movePiece: (id: string, zone: BoardZoneRef, owner?: BoardPlayer) => void;
  updatePiece: (id: string, patch: Partial<Omit<BoardPiece, "id">>) => void;
  toggleKeyword: (id: string, keyword: string) => void;
  adjustMight: (id: string, delta: number) => void;
  adjustDamage: (id: string, delta: number) => void;
  adjustBuffs: (id: string, delta: number) => void;
  duplicatePiece: (id: string) => void;
  removePiece: (id: string) => void;
  selectPiece: (id: string | null) => void;
  toggleSelectPiece: (id: string) => void;
  /** Replaces the selection; the last id becomes the primary piece. */
  selectPieces: (ids: string[]) => void;

  addArrow: (arrow: BoardArrow) => void;
  removeArrow: (index: number) => void;
  /** Returns the new entry's id, or null once the chain is full. */
  addChainEntry: (entry: Omit<BoardChainEntry, "id">) => string | null;
  updateChainEntry: (id: string, patch: Partial<Omit<BoardChainEntry, "id">>) => void;
  removeChainEntry: (id: string) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextKeywords(keywords: string[], keyword: string): string[] {
  if (keywords.includes(keyword)) {
    return keywords.filter((entry) => entry !== keyword);
  }
  if (keywords.length >= MAX_PIECE_KEYWORDS) {
    return keywords;
  }
  return [...keywords, keyword];
}

/** `undefined` in the patch removes the key. */
function patched<T extends object>(value: T, patch: Partial<NoInfer<T>>): T {
  return Object.fromEntries(
    Object.entries({ ...value, ...patch }).filter(([, field]) => field !== undefined),
  ) as T;
}

function pushed(state: BoardEditorState, tag: string | null = null): BoardDocument[] {
  if (tag !== null && tag === state.historyTag) {
    return state.history;
  }
  return [...state.history, state.document].slice(-HISTORY_LIMIT);
}

function withStep(
  state: BoardEditorState,
  update: (step: BoardStep) => BoardStep,
  tag: string | null = null,
): Partial<BoardEditorState> {
  const steps = state.document.steps.map((step, index) =>
    index === state.activeStep ? update(step) : step,
  );
  return {
    document: { ...state.document, steps },
    dirty: true,
    history: pushed(state, tag),
    historyTag: tag,
  };
}

function withDocument(state: BoardEditorState, document: BoardDocument): Partial<BoardEditorState> {
  return { document, dirty: true, history: pushed(state), historyTag: null };
}

/**
 * Drops arrows and chain links left dangling by a removal. An ability that loses its
 * source keeps the source card's name as its label, or goes if it has nothing else.
 */
function pruneStep(step: BoardStep, removed: readonly BoardPiece[] = []): BoardStep {
  const pieceIds = new Set(step.pieces.map((piece) => piece.id));
  const chain = step.chain.flatMap((entry): BoardChainEntry[] => {
    if (entry.source === undefined || pieceIds.has(entry.source)) {
      return [entry];
    }
    const sourceName = removed.find((piece) => piece.id === entry.source)?.card?.name;
    const kept = patched(entry, { source: undefined, label: entry.label ?? sourceName });
    return kept.label === undefined && kept.card === undefined ? [] : [kept];
  });
  const chainIds = new Set(chain.map((entry) => entry.id));
  const exists = (end: BoardArrow["to"]) =>
    "piece" in end ? pieceIds.has(end.piece) : "chain" in end ? chainIds.has(end.chain) : true;
  const arrows = step.arrows.filter((arrow) => exists(arrow.from) && exists(arrow.to));
  return { ...step, chain, arrows };
}

function updatePieces(step: BoardStep, id: string, update: (piece: BoardPiece) => BoardPiece) {
  return {
    ...step,
    pieces: step.pieces.map((piece) => (piece.id === id ? update(piece) : piece)),
  };
}

function prunePlayers(step: BoardStep, players: ReadonlySet<BoardPlayer>): BoardStep {
  const inGame = (player: BoardPlayer | undefined) =>
    player === undefined || players.has(player) ? player : undefined;
  const pieces = step.pieces.filter((piece) => players.has(piece.owner));
  return pruneStep(
    {
      ...step,
      pieces,
      chain: step.chain.filter((entry) => players.has(entry.owner)),
      turn: patched(step.turn, {
        player: inGame(step.turn.player),
        priority: inGame(step.turn.priority),
        focus: inGame(step.turn.focus),
      }),
      players: Object.fromEntries(
        Object.entries(step.players).filter(([player]) => players.has(player as BoardPlayer)),
      ),
      battlefields: step.battlefields.map((battlefield) => ({
        ...battlefield,
        controller:
          battlefield.controller !== null && players.has(battlefield.controller)
            ? battlefield.controller
            : null,
        scoredBy: battlefield.scoredBy.filter((player) => players.has(player)),
      })),
    },
    step.pieces.filter((piece) => !players.has(piece.owner)),
  );
}

export const useBoardEditorStore = create<BoardEditorState>()((set, get) => ({
  document: emptyBoardDocument(),
  activeStep: 0,
  selectedPieceId: null,
  selectedPieceIds: [],
  dirty: false,
  history: [],
  historyTag: null,
  recentCardIds: [],

  undo: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) {
        return state;
      }
      return {
        document: previous,
        history: state.history.slice(0, -1),
        activeStep: Math.min(state.activeStep, previous.steps.length - 1),
        selectedPieceId: null,
        selectedPieceIds: [],
        dirty: true,
        historyTag: null,
      };
    }),

  load: (document) =>
    set({
      document,
      activeStep: 0,
      selectedPieceId: null,
      selectedPieceIds: [],
      dirty: false,
      history: [],
      historyTag: null,
    }),

  setPlayerCount: (count) =>
    set((state) => {
      const playerCount = Math.min(4, Math.max(2, count));
      const players = new Set<BoardPlayer>(BOARD_PLAYERS.slice(0, playerCount));
      return withDocument(state, {
        ...state.document,
        playerCount,
        scoring: playerCount === 4 ? state.document.scoring : "players",
        steps: state.document.steps.map((step) => prunePlayers(step, players)),
      });
    }),

  setScoring: (scoring) =>
    set((state) => {
      if (scoring === "teams" && state.document.playerCount !== 4) {
        return state;
      }
      const steps =
        scoring === "players"
          ? state.document.steps
          : state.document.steps.map((step) => ({
              ...step,
              players: Object.fromEntries(
                Object.entries(step.players).map(([player, stats]) => [
                  player,
                  player === "C" || player === "D" ? patched(stats, { score: undefined }) : stats,
                ]),
              ),
            }));
      return withDocument(state, { ...state.document, scoring, steps });
    }),

  setBattlefieldCount: (count) =>
    set((state) => {
      const next = Math.min(MAX_BATTLEFIELDS, Math.max(1, count));
      const battlefields = Array.from(
        { length: next },
        (_, index) => state.document.battlefields[index] ?? { card: null },
      );
      const steps = state.document.steps.map((step) => {
        const onTable = (piece: BoardPiece) => (zoneBattlefieldIndex(piece.zone) ?? 0) < next;
        return pruneStep(
          {
            ...step,
            pieces: step.pieces.filter((piece) => onTable(piece)),
            battlefields: Array.from(
              { length: next },
              (_, index) => step.battlefields[index] ?? emptyBattlefieldState(),
            ),
          },
          step.pieces.filter((piece) => !onTable(piece)),
        );
      });
      return withDocument(state, { ...state.document, battlefields, steps });
    }),

  setBattlefieldCard: (index, card) =>
    set((state) =>
      withDocument(state, {
        ...state.document,
        battlefields: state.document.battlefields.map((battlefield, i) =>
          i === index ? { card } : battlefield,
        ),
      }),
    ),

  setZoneVisible: (zone, visible) =>
    set((state) =>
      withDocument(state, {
        ...state.document,
        zones: { ...state.document.zones, [zone]: visible },
      }),
    ),

  selectStep: (index) =>
    set((state) => ({
      activeStep: Math.min(state.document.steps.length - 1, Math.max(0, index)),
      selectedPieceId: null,
      selectedPieceIds: [],
    })),

  addStep: () =>
    set((state) => {
      const { steps } = state.document;
      const current = steps[state.activeStep];
      if (!current || steps.length >= MAX_BOARD_STEPS) {
        return state;
      }
      const copy: BoardStep = { ...structuredClone(current), caption: "" };
      const insertAt = state.activeStep + 1;
      return {
        document: { ...state.document, steps: steps.toSpliced(insertAt, 0, copy) },
        activeStep: insertAt,
        selectedPieceId: null,
        selectedPieceIds: [],
        dirty: true,
        history: pushed(state),
        historyTag: null,
      };
    }),

  removeStep: (index) =>
    set((state) => {
      const { steps } = state.document;
      if (steps.length <= 1) {
        return state;
      }
      const next = steps.toSpliced(index, 1);
      return {
        document: { ...state.document, steps: next },
        activeStep: Math.min(state.activeStep, next.length - 1),
        selectedPieceId: null,
        selectedPieceIds: [],
        dirty: true,
        history: pushed(state),
        historyTag: null,
      };
    }),

  moveStep: (from, to) =>
    set((state) => {
      const { steps } = state.document;
      const moved = steps[from];
      if (!moved || to < 0 || to >= steps.length || from === to) {
        return state;
      }
      const next = steps.toSpliced(from, 1).toSpliced(to, 0, moved);
      return {
        document: { ...state.document, steps: next },
        activeStep: to,
        dirty: true,
        history: pushed(state),
        historyTag: null,
      };
    }),

  setCaption: (caption) =>
    set((state) =>
      withStep(state, (step) => ({ ...step, caption }), `caption:${state.activeStep}`),
    ),

  setTurn: (patch) =>
    set((state) => withStep(state, (step) => ({ ...step, turn: patched(step.turn, patch) }))),

  setPlayerStats: (player, patch) =>
    set((state) =>
      withStep(
        state,
        (step) => {
          const stats = patched(step.players[player] ?? {}, patch);
          const empty = Object.keys(stats).length === 0;
          return {
            ...step,
            players: patched(step.players, { [player]: empty ? undefined : stats }),
          };
        },
        `stats:${state.activeStep}:${player}:${Object.keys(patch).join(",")}`,
      ),
    ),

  setBattlefieldState: (index, patch) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        battlefields: step.battlefields.map((battlefield, i) =>
          i === index ? { ...battlefield, ...patch } : battlefield,
        ),
      })),
    ),

  addPiece: ({ owner, zone, kind, card }) => {
    const step = get().document.steps[get().activeStep];
    const id = nextPieceId(step?.pieces ?? []);
    const piece: BoardPiece = {
      id,
      owner,
      zone,
      kind,
      card,
      exhausted: false,
      facedown: isHiddenZone(zone),
      keywords: [],
      damage: 0,
      might: 0,
      buffs: 0,
      highlight: false,
    };
    set((state) => ({
      ...withStep(state, (current) => ({ ...current, pieces: [...current.pieces, piece] })),
      selectedPieceId: id,
      selectedPieceIds: [id],
      recentCardIds:
        card === null
          ? state.recentCardIds
          : [card.cardId, ...state.recentCardIds.filter((recent) => recent !== card.cardId)].slice(
              0,
              RECENT_LIMIT,
            ),
    }));
    return id;
  },

  movePiece: (id, zone, owner) =>
    set((state) =>
      withStep(state, (step) =>
        updatePieces(step, id, (piece) => ({
          ...piece,
          zone,
          owner: owner ?? piece.owner,
          facedown:
            isHiddenZone(zone) === isHiddenZone(piece.zone) ? piece.facedown : isHiddenZone(zone),
        })),
      ),
    ),

  updatePiece: (id, patch) =>
    set((state) =>
      withStep(state, (step) => updatePieces(step, id, (piece) => patched(piece, patch))),
    ),

  toggleKeyword: (id, keyword) =>
    set((state) =>
      withStep(state, (step) =>
        updatePieces(step, id, (piece) => ({
          ...piece,
          keywords: nextKeywords(piece.keywords, keyword),
        })),
      ),
    ),

  adjustMight: (id, delta) =>
    set((state) =>
      withStep(state, (step) =>
        updatePieces(step, id, (piece) => ({
          ...piece,
          might: clamp(piece.might + delta, -99, 99),
        })),
      ),
    ),

  adjustDamage: (id, delta) =>
    set((state) =>
      withStep(state, (step) =>
        updatePieces(step, id, (piece) => ({
          ...piece,
          damage: clamp(piece.damage + delta, 0, 99),
        })),
      ),
    ),

  adjustBuffs: (id, delta) =>
    set((state) =>
      withStep(state, (step) =>
        updatePieces(step, id, (piece) => ({
          ...piece,
          buffs: clamp(piece.buffs + delta, 0, MAX_PIECE_BUFFS),
        })),
      ),
    ),

  duplicatePiece: (id) => {
    const current = get();
    const step = current.document.steps[current.activeStep];
    const source = step?.pieces.find((piece) => piece.id === id);
    if (!step || !source) {
      return;
    }
    const copyId = nextPieceId(step.pieces);
    set((state) => ({
      ...withStep(state, (target) => ({
        ...target,
        pieces: [...target.pieces, { ...structuredClone(source), id: copyId }],
      })),
      selectedPieceId: copyId,
      selectedPieceIds: [copyId],
    }));
  },

  removePiece: (id) =>
    set((state) => ({
      ...withStep(state, (step) =>
        pruneStep(
          { ...step, pieces: step.pieces.filter((piece) => piece.id !== id) },
          step.pieces.filter((piece) => piece.id === id),
        ),
      ),
      selectedPieceIds: state.selectedPieceIds.filter((selected) => selected !== id),
      selectedPieceId: state.selectedPieceIds.filter((selected) => selected !== id).at(-1) ?? null,
    })),

  selectPiece: (id) => set({ selectedPieceId: id, selectedPieceIds: id === null ? [] : [id] }),

  selectPieces: (ids) => set({ selectedPieceIds: ids, selectedPieceId: ids.at(-1) ?? null }),

  toggleSelectPiece: (id) =>
    set((state) => {
      const selectedPieceIds = state.selectedPieceIds.includes(id)
        ? state.selectedPieceIds.filter((selected) => selected !== id)
        : [...state.selectedPieceIds, id];
      return { selectedPieceIds, selectedPieceId: selectedPieceIds.at(-1) ?? null };
    }),

  addArrow: (arrow) =>
    set((state) => withStep(state, (step) => ({ ...step, arrows: [...step.arrows, arrow] }))),

  removeArrow: (index) =>
    set((state) =>
      withStep(state, (step) => ({ ...step, arrows: step.arrows.toSpliced(index, 1) })),
    ),

  addChainEntry: (entry) => {
    const step = get().document.steps[get().activeStep];
    if (!step || step.chain.length >= MAX_CHAIN_ENTRIES) {
      return null;
    }
    const id = nextChainId(step.chain);
    set((state) =>
      withStep(state, (current) => ({ ...current, chain: [...current.chain, { ...entry, id }] })),
    );
    return id;
  },

  updateChainEntry: (id, patch) =>
    set((state) =>
      withStep(
        state,
        (step) => ({
          ...step,
          chain: step.chain.map((entry) => (entry.id === id ? patched(entry, patch) : entry)),
        }),
        `chain:${state.activeStep}:${id}:${Object.keys(patch).join(",")}`,
      ),
    ),

  removeChainEntry: (id) =>
    set((state) =>
      withStep(state, (step) =>
        pruneStep({ ...step, chain: step.chain.filter((entry) => entry.id !== id) }),
      ),
    ),
}));
