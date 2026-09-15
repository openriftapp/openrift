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
} from "@openrift/shared/board-state";
import { create } from "zustand";

import { nextPieceId } from "@/features/rules/lib/board-layout";

interface BoardEditorState {
  document: BoardDocument;
  activeStep: number;
  selectedPieceId: string | null;
  dirty: boolean;

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
  removePiece: (id: string) => void;
  selectPiece: (id: string | null) => void;

  addArrow: (arrow: BoardArrow) => void;
  removeArrow: (index: number) => void;
  addChainEntry: (entry: BoardChainEntry) => void;
  removeChainEntry: (index: number) => void;
}

function withStep(
  state: BoardEditorState,
  update: (step: BoardStep) => BoardStep,
): Partial<BoardEditorState> {
  const steps = state.document.steps.map((step, index) =>
    index === state.activeStep ? update(step) : step,
  );
  return { document: { ...state.document, steps }, dirty: true };
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
  dirty: false,

  load: (document) => set({ document, activeStep: 0, selectedPieceId: null, dirty: false }),

  setPlayerCount: (count) =>
    set((state) => {
      const playerCount = Math.min(4, Math.max(2, count));
      const players = new Set<BoardPlayer>(BOARD_PLAYERS.slice(0, playerCount));
      const steps = withAllSteps(state, (piece) => players.has(piece.owner));
      const trimmed = steps.map((step) => ({
        ...step,
        chain: step.chain.filter((entry) => players.has(entry.owner)),
      }));
      return { document: { ...state.document, playerCount, steps: trimmed }, dirty: true };
    }),

  setBattlefieldCount: (count) =>
    set((state) => {
      const next = Math.min(MAX_BATTLEFIELDS, Math.max(0, count));
      const battlefields = Array.from(
        { length: next },
        (_, index) => state.document.battlefields[index] ?? { card: null },
      );
      const steps = withAllSteps(
        state,
        (piece) => piece.zone.kind !== "battlefield" || piece.zone.index < next,
      );
      return { document: { ...state.document, battlefields, steps }, dirty: true };
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
    })),

  setZoneVisible: (zone, visible) =>
    set((state) => ({
      document: { ...state.document, zones: { ...state.document.zones, [zone]: visible } },
      dirty: true,
    })),

  selectStep: (index) =>
    set((state) => ({
      activeStep: Math.min(state.document.steps.length - 1, Math.max(0, index)),
      selectedPieceId: null,
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
        dirty: true,
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
        dirty: true,
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
      return { document: { ...state.document, steps: next }, activeStep: to, dirty: true };
    }),

  setCaption: (caption) => set((state) => withStep(state, (step) => ({ ...step, caption }))),

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
      stunned: false,
      damage: 0,
      buff: 0,
      highlight: false,
    };
    set((state) => ({
      ...withStep(state, (current) => ({ ...current, pieces: [...current.pieces, piece] })),
      selectedPieceId: id,
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

  removePiece: (id) =>
    set((state) => ({
      ...withStep(state, (step) => ({
        ...step,
        pieces: step.pieces.filter((piece) => piece.id !== id),
        arrows: step.arrows.filter(
          (arrow) => arrow.from !== id && !("piece" in arrow.to && arrow.to.piece === id),
        ),
      })),
      selectedPieceId: state.selectedPieceId === id ? null : state.selectedPieceId,
    })),

  selectPiece: (id) => set({ selectedPieceId: id }),

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
