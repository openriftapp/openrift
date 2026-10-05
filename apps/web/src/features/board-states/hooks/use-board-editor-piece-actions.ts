import type { BoardPiece, BoardPlayer } from "@openrift/shared/board-state";
import { BOARD_PLAYERS } from "@openrift/shared/board-state";

import { useBoardEditorStore } from "@/features/board-states/stores/board-editor-store";

export interface BoardPieceActions {
  toggleExhaust: () => void;
  toggleHighlight: () => void;
  toggleFacedown: () => void;
  adjustDamage: (delta: number) => void;
  adjustMight: (delta: number) => void;
  adjustBuffs: (delta: number) => void;
  setCounter: (counter: BoardPiece["counter"]) => void;
  toggleKeyword: (keyword: string) => void;
  setLabel: (label: string) => void;
  setOwner: (owner: BoardPlayer) => void;
  nextOwner: () => void;
  setPrinting: (printingId: string) => void;
  duplicate: () => void;
  remove: () => void;
}

/** Acts on every selected piece; the last one is the primary for single-piece fields. No-ops while nothing is selected. */
export function useBoardEditorPieceActions(pieces: readonly BoardPiece[]): BoardPieceActions {
  const playerCount = useBoardEditorStore((state) => state.document.playerCount);
  const updatePiece = useBoardEditorStore((state) => state.updatePiece);
  const toggleKeyword = useBoardEditorStore((state) => state.toggleKeyword);
  const adjustDamage = useBoardEditorStore((state) => state.adjustDamage);
  const adjustMight = useBoardEditorStore((state) => state.adjustMight);
  const adjustBuffs = useBoardEditorStore((state) => state.adjustBuffs);
  const duplicatePiece = useBoardEditorStore((state) => state.duplicatePiece);
  const removePiece = useBoardEditorStore((state) => state.removePiece);
  const primary = pieces.at(-1) ?? null;
  const each = (apply: (piece: BoardPiece) => void) => {
    for (const piece of pieces) {
      apply(piece);
    }
  };

  return {
    toggleExhaust: () => {
      const exhausted = !primary?.exhausted;
      each((piece) => updatePiece(piece.id, { exhausted }));
    },
    toggleHighlight: () => {
      const highlight = !primary?.highlight;
      each((piece) => updatePiece(piece.id, { highlight }));
    },
    toggleFacedown: () => {
      const facedown = !primary?.facedown;
      each((piece) => updatePiece(piece.id, { facedown }));
    },
    adjustDamage: (delta) => each((piece) => adjustDamage(piece.id, delta)),
    adjustMight: (delta) => each((piece) => adjustMight(piece.id, delta)),
    adjustBuffs: (delta) =>
      each((piece) => {
        if (piece.kind === "unit") {
          adjustBuffs(piece.id, delta);
        }
      }),
    setCounter: (counter) => {
      if (primary) {
        updatePiece(primary.id, { counter });
      }
    },
    toggleKeyword: (keyword) => {
      if (keyword.trim() !== "") {
        each((piece) => toggleKeyword(piece.id, keyword.trim()));
      }
    },
    setLabel: (label) => {
      if (primary) {
        updatePiece(primary.id, { label: label === "" ? undefined : label });
      }
    },
    setOwner: (owner) => each((piece) => updatePiece(piece.id, { owner })),
    nextOwner: () => {
      const players = BOARD_PLAYERS.slice(0, playerCount);
      each((piece) => {
        const next = players[(players.indexOf(piece.owner) + 1) % players.length];
        if (next) {
          updatePiece(piece.id, { owner: next });
        }
      });
    },
    setPrinting: (printingId) => {
      if (primary?.card) {
        updatePiece(primary.id, { card: { ...primary.card, printingId } });
      }
    },
    duplicate: () => {
      if (primary) {
        duplicatePiece(primary.id);
      }
    },
    remove: () => each((piece) => removePiece(piece.id)),
  };
}
