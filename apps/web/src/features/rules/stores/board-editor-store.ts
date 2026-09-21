import type {
  BoardArrow,
  BoardCardRef,
  BoardChainEntry,
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
} from "@openrift/shared/board-state";
import {
  BOARD_PLAYERS,
  emptyBoardDocument,
  MAX_BATTLEFIELDS,
  MAX_BOARD_STEPS,
  MAX_PIECE_KEYWORDS,
} from "@openrift/shared/board-state";
import { create } from "zustand";

import { nextPieceId } from "@/features/rules/lib/board-layout";

const HISTORY_LIMIT = 50;

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

  undo: () => void;
  load: (document: BoardDocument) => void;
  setPlayerCount: (count: number) => void;
  setBattlefieldCount: (count: number) => void;
  setBattlefieldCard: (index: number, card: BoardCardRef | null) => void;
  setZoneVisible: (zone: keyof BoardZoneVisibility, visible: boolean) => void;

  selectStep: (index: number) => void;
  addStep: () => void;
  removeStep: (index: number) => void;
  moveStep: (from: number, to: number) => void;
  setCaption: (caption: string) => void;

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
  duplicatePiece: (id: string) => void;
  removePiece: (id: string) => void;
  selectPiece: (id: string | null) => void;
  toggleSelectPiece: (id: string) => void;
  /** Replaces the selection; the last id becomes the primary piece. */
  selectPieces: (ids: string[]) => void;

  addArrow: (arrow: BoardArrow) => void;
  removeArrow: (index: number) => void;
  addChainEntry: (entry: BoardChainEntry) => void;
  removeChainEntry: (index: number) => void;
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

function withAllSteps(state: BoardEditorState, keep: (piece: BoardPiece) => boolean): BoardStep[] {
  return state.document.steps.map((step) => {
    const pieces = step.pieces.filter((piece) => keep(piece));
    const ids = new Set(pieces.map((piece) => piece.id));
    const arrows = step.arrows.filter(
      (arrow) => ids.has(arrow.from) && (!("piece" in arrow.to) || ids.has(arrow.to.piece)),
    );
    return { ...step, pieces, arrows };
  });
}

export const useBoardEditorStore = create<BoardEditorState>()((set, get) => ({
  document: emptyBoardDocument(),
  activeStep: 0,
  selectedPieceId: null,
  selectedPieceIds: [],
  dirty: false,
  history: [],
  historyTag: null,

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
      const steps = withAllSteps(state, (piece) => players.has(piece.owner));
      const trimmed = steps.map((step) => ({
        ...step,
        chain: step.chain.filter((entry) => players.has(entry.owner)),
      }));
      return {
        document: { ...state.document, playerCount, steps: trimmed },
        dirty: true,
        history: pushed(state),
        historyTag: null,
      };
    }),

  setBattlefieldCount: (count) =>
    set((state) => {
      const next = Math.min(MAX_BATTLEFIELDS, Math.max(1, count));
      const battlefields = Array.from(
        { length: next },
        (_, index) => state.document.battlefields[index] ?? { card: null },
      );
      const steps = withAllSteps(
        state,
        (piece) => piece.zone.kind !== "battlefield" || piece.zone.index < next,
      );
      return {
        document: { ...state.document, battlefields, steps },
        dirty: true,
        history: pushed(state),
        historyTag: null,
      };
    }),

  setBattlefieldCard: (index, card) =>
    set((state) => ({
      document: {
        ...state.document,
        battlefields: state.document.battlefields.map((battlefield, i) =>
          i === index ? { card } : battlefield,
        ),
      },
      dirty: true,
      history: pushed(state),
      historyTag: null,
    })),

  setZoneVisible: (zone, visible) =>
    set((state) => ({
      document: { ...state.document, zones: { ...state.document.zones, [zone]: visible } },
      dirty: true,
      history: pushed(state),
      historyTag: null,
    })),

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
      keywords: [],
      damage: 0,
      might: 0,
      highlight: false,
    };
    set((state) => ({
      ...withStep(state, (current) => ({ ...current, pieces: [...current.pieces, piece] })),
      selectedPieceId: id,
      selectedPieceIds: [id],
    }));
    return id;
  },

  movePiece: (id, zone, owner) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.map((piece) =>
          piece.id === id ? { ...piece, zone, owner: owner ?? piece.owner } : piece,
        ),
      })),
    ),

  updatePiece: (id, patch) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.map((piece) => (piece.id === id ? { ...piece, ...patch } : piece)),
      })),
    ),

  toggleKeyword: (id, keyword) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.map((piece) =>
          piece.id === id ? { ...piece, keywords: nextKeywords(piece.keywords, keyword) } : piece,
        ),
      })),
    ),

  adjustMight: (id, delta) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.map((piece) =>
          piece.id === id ? { ...piece, might: clamp(piece.might + delta, -99, 99) } : piece,
        ),
      })),
    ),

  adjustDamage: (id, delta) =>
    set((state) =>
      withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.map((piece) =>
          piece.id === id ? { ...piece, damage: clamp(piece.damage + delta, 0, 99) } : piece,
        ),
      })),
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
      ...withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.filter((piece) => piece.id !== id),
        arrows: step.arrows.filter(
          (arrow) => arrow.from !== id && !("piece" in arrow.to && arrow.to.piece === id),
        ),
      })),
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

  addChainEntry: (entry) =>
    set((state) => withStep(state, (step) => ({ ...step, chain: [...step.chain, entry] }))),

  removeChainEntry: (index) =>
    set((state) => withStep(state, (step) => ({ ...step, chain: step.chain.toSpliced(index, 1) }))),
}));
