// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useBoardEditorPieceActions } from "./use-board-editor-piece-actions";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBoardEditorStore);
});

afterEach(() => {
  resetStore();
});

const store = () => useBoardEditorStore.getState();
const pieces = () => store().document.steps[store().activeStep]!.pieces;

function addPieces() {
  const unit = store().addPiece({
    owner: "A",
    zone: { kind: "battlefield", index: 0 },
    kind: "unit",
    card: null,
  });
  const gear = store().addPiece({ owner: "A", zone: { kind: "base" }, kind: "gear", card: null });
  return { unit, gear };
}

function actionsFor(ids: string[]) {
  const selected = pieces().filter((piece) => ids.includes(piece.id));
  return renderHook(() => useBoardEditorPieceActions(selected)).result.current;
}

describe("useBoardEditorPieceActions", () => {
  it("buffs only the units in a mixed selection", () => {
    const { unit, gear } = addPieces();
    const actions = actionsFor([unit, gear]);
    act(() => actions.adjustBuffs(1));
    expect(pieces().find((piece) => piece.id === unit)!.buffs).toBe(1);
    expect(pieces().find((piece) => piece.id === gear)!.buffs).toBe(0);
  });

  it("turns every selected piece facedown, following the primary piece", () => {
    const { unit, gear } = addPieces();
    store().updatePiece(unit, { facedown: true });
    const actions = actionsFor([unit, gear]);
    act(() => actions.toggleFacedown());
    expect(pieces().map((piece) => piece.facedown)).toEqual([true, true]);
  });

  it("sets and clears the primary piece's counter", () => {
    const { unit } = addPieces();
    const set = actionsFor([unit]);
    act(() => set.setCounter({ value: 3, label: "Charge" }));
    expect(pieces()[0]!.counter).toEqual({ value: 3, label: "Charge" });
    const clear = actionsFor([unit]);
    act(() => clear.setCounter(undefined));
    expect(pieces()[0]).not.toHaveProperty("counter");
  });
});
