import {
  boardDocumentSchema,
  emptyBoardDocument,
  MAX_BOARD_STEPS,
} from "@openrift/shared/board-state";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useBoardEditorStore } from "./board-editor-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBoardEditorStore);
});

afterEach(() => {
  resetStore();
});

const store = () => useBoardEditorStore.getState();
const activeStep = () => store().document.steps[store().activeStep]!;

function addUnit(owner: "A" | "B" | "C" | "D" = "A", index = 0) {
  return store().addPiece({
    owner,
    zone: { kind: "battlefield", index },
    kind: "unit",
    card: null,
  });
}

describe("useBoardEditorStore", () => {
  it("starts with a valid empty document", () => {
    expect(boardDocumentSchema.safeParse(store().document).success).toBe(true);
    expect(store().dirty).toBe(false);
  });

  it("load replaces the document and clears dirty state", () => {
    addUnit();
    const doc = { ...emptyBoardDocument(), playerCount: 4 };
    store().load(doc);
    expect(store().document.playerCount).toBe(4);
    expect(store().dirty).toBe(false);
    expect(store().selectedPieceId).toBeNull();
  });

  describe("pieces", () => {
    it("adds a piece with sequential ids and selects it", () => {
      expect(addUnit()).toBe("p1");
      expect(addUnit("B")).toBe("p2");
      expect(activeStep().pieces).toHaveLength(2);
      expect(store().selectedPieceId).toBe("p2");
      expect(store().dirty).toBe(true);
    });

    it("moves a piece to another zone and owner", () => {
      const id = addUnit();
      store().movePiece(id, { kind: "base" }, "B");
      expect(activeStep().pieces[0]).toMatchObject({ zone: { kind: "base" }, owner: "B" });
    });

    it("updates piece state", () => {
      const id = addUnit();
      store().updatePiece(id, { exhausted: true, damage: 2, label: "Hidden" });
      expect(activeStep().pieces[0]).toMatchObject({ exhausted: true, damage: 2, label: "Hidden" });
    });

    it("removes a piece and the arrows that reference it", () => {
      const a = addUnit();
      const b = addUnit("B");
      store().addArrow({ kind: "target", from: a, to: { piece: b } });
      store().removePiece(b);
      expect(activeStep().pieces.map((piece) => piece.id)).toEqual([a]);
      expect(activeStep().arrows).toEqual([]);
      expect(store().selectedPieceId).toBeNull();
    });
  });

  describe("piece keywords, might and damage", () => {
    it("adds a piece with no keywords and no might modifier", () => {
      const id = addUnit();
      const piece = activeStep().pieces.find((entry) => entry.id === id)!;
      expect(piece.keywords).toEqual([]);
      expect(piece.might).toBe(0);
    });

    it("toggles a keyword on and off, preserving order", () => {
      const id = addUnit();
      store().toggleKeyword(id, "Stun");
      store().toggleKeyword(id, "Shield");
      expect(activeStep().pieces[0]!.keywords).toEqual(["Stun", "Shield"]);
      store().toggleKeyword(id, "Stun");
      expect(activeStep().pieces[0]!.keywords).toEqual(["Shield"]);
    });

    it("stops adding keywords at six", () => {
      const id = addUnit();
      for (const keyword of ["a", "b", "c", "d", "e", "f", "g"]) {
        store().toggleKeyword(id, keyword);
      }
      expect(activeStep().pieces[0]!.keywords).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("clamps the might modifier to the allowed range", () => {
      const id = addUnit();
      store().adjustMight(id, -2);
      expect(activeStep().pieces[0]!.might).toBe(-2);
      store().adjustMight(id, -200);
      expect(activeStep().pieces[0]!.might).toBe(-99);
      store().adjustMight(id, 500);
      expect(activeStep().pieces[0]!.might).toBe(99);
    });

    it("clamps damage at zero and ninety-nine", () => {
      const id = addUnit();
      store().adjustDamage(id, -1);
      expect(activeStep().pieces[0]!.damage).toBe(0);
      store().adjustDamage(id, 3);
      expect(activeStep().pieces[0]!.damage).toBe(3);
      store().adjustDamage(id, 200);
      expect(activeStep().pieces[0]!.damage).toBe(99);
    });
  });

  describe("steps", () => {
    it("adds a step as a copy of the active one with an empty caption", () => {
      addUnit();
      store().setCaption("First");
      store().addStep();
      expect(store().document.steps).toHaveLength(2);
      expect(store().activeStep).toBe(1);
      expect(activeStep().caption).toBe("");
      expect(activeStep().pieces).toHaveLength(1);
    });

    it("keeps copied steps independent", () => {
      const id = addUnit();
      store().addStep();
      store().updatePiece(id, { highlight: true });
      expect(store().document.steps[0]!.pieces[0]!.highlight).toBe(false);
    });

    it("never removes the last step", () => {
      store().removeStep(0);
      expect(store().document.steps).toHaveLength(1);
    });

    it("clamps the active step after removal", () => {
      store().addStep();
      store().removeStep(1);
      expect(store().activeStep).toBe(0);
    });

    it("reorders steps and follows the moved step", () => {
      store().setCaption("one");
      store().addStep();
      store().setCaption("two");
      store().moveStep(1, 0);
      expect(store().document.steps.map((step) => step.caption)).toEqual(["two", "one"]);
      expect(store().activeStep).toBe(0);
    });

    it("ignores an out-of-range move", () => {
      store().moveStep(0, 5);
      expect(store().document.steps).toHaveLength(1);
    });

    it("stops adding steps at the limit", () => {
      for (let i = 0; i < MAX_BOARD_STEPS + 2; i++) {
        store().addStep();
      }
      expect(store().document.steps).toHaveLength(MAX_BOARD_STEPS);
    });
  });

  describe("game setup", () => {
    it("drops pieces and chain entries of removed players", () => {
      store().setPlayerCount(4);
      store().setBattlefieldCount(1);
      addUnit("A");
      addUnit("D");
      store().addChainEntry({
        owner: "D",
        card: { cardId: "00000000-0000-7000-8000-000000000001", name: "Spell" },
      });
      store().setPlayerCount(2);
      expect(activeStep().pieces.map((piece) => piece.owner)).toEqual(["A"]);
      expect(activeStep().chain).toEqual([]);
    });

    it("clamps the player count to 2..4", () => {
      store().setPlayerCount(9);
      expect(store().document.playerCount).toBe(4);
      store().setPlayerCount(1);
      expect(store().document.playerCount).toBe(2);
    });

    it("drops pieces on removed battlefields and keeps existing cards", () => {
      store().setBattlefieldCount(3);
      store().setBattlefieldCard(0, { cardId: crypto.randomUUID(), name: "Battlefield" });
      addUnit("A", 2);
      addUnit("A", 0);
      store().setBattlefieldCount(1);
      expect(store().document.battlefields).toHaveLength(1);
      expect(store().document.battlefields[0]!.card?.name).toBe("Battlefield");
      expect(activeStep().pieces.map((piece) => piece.zone)).toEqual([
        { kind: "battlefield", index: 0 },
      ]);
    });

    it("toggles zone visibility", () => {
      store().setZoneVisible("runes", true);
      expect(store().document.zones.runes).toBe(true);
    });
  });

  describe("history", () => {
    it("undoes the last mutation", () => {
      const id = addUnit();
      store().updatePiece(id, { exhausted: true });
      store().undo();
      expect(activeStep().pieces[0]!.exhausted).toBe(false);
      store().undo();
      expect(activeStep().pieces).toHaveLength(0);
    });

    it("does nothing when there is nothing to undo", () => {
      const before = store().document;
      store().undo();
      expect(store().document).toBe(before);
    });

    it("clamps the active step to the restored document", () => {
      addUnit();
      store().addStep();
      expect(store().activeStep).toBe(1);
      store().undo();
      expect(store().activeStep).toBe(0);
      expect(store().document.steps).toHaveLength(1);
    });

    it("keeps at most 50 snapshots", () => {
      const id = addUnit();
      for (let i = 0; i < 60; i++) {
        store().adjustDamage(id, 1);
      }
      expect(store().history).toHaveLength(50);
    });

    it("collapses a run of caption keystrokes into one undo step", () => {
      addUnit();
      const before = store().history.length;
      for (const caption of ["A", "Ab", "Abc"]) {
        store().setCaption(caption);
      }
      expect(store().history).toHaveLength(before + 1);
      store().undo();
      expect(activeStep().caption).toBe("");
    });

    it("starts a new undo step when another edit interrupts the caption", () => {
      store().setCaption("one");
      store().setZoneVisible("trash", true);
      store().setCaption("two");
      store().undo();
      expect(activeStep().caption).toBe("one");
    });

    it("keeps captions on different steps apart", () => {
      store().setCaption("first");
      store().addStep();
      store().setCaption("second");
      store().undo();
      expect(activeStep().caption).toBe("");
    });

    it("load clears the history", () => {
      addUnit();
      store().load(emptyBoardDocument());
      expect(store().history).toEqual([]);
    });
  });

  it("duplicates a piece under a fresh id and selects the copy", () => {
    const id = addUnit();
    store().updatePiece(id, { keywords: ["Stun"], damage: 2 });
    store().duplicatePiece(id);
    const [original, copy] = activeStep().pieces;
    expect(activeStep().pieces).toHaveLength(2);
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.keywords).toEqual(["Stun"]);
    expect(copy!.damage).toBe(2);
    expect(store().selectedPieceId).toBe(copy!.id);
  });

  it("ignores duplicating a missing piece", () => {
    store().duplicatePiece("nope");
    expect(activeStep().pieces).toHaveLength(0);
  });

  it("keeps the document valid through a typical edit session", () => {
    store().setPlayerCount(4);
    store().setBattlefieldCount(3);
    const a = addUnit("A", 2);
    const d = addUnit("D", 1);
    store().addArrow({ kind: "move", from: a, to: { zone: { kind: "base" }, owner: "A" } });
    store().addStep();
    store().updatePiece(d, { exhausted: true });
    store().removeArrow(0);
    expect(boardDocumentSchema.safeParse(store().document).success).toBe(true);
  });

  describe("toggleSelectPiece", () => {
    it("builds a shift-click selection whose last entry is the primary piece", () => {
      const a = addUnit("A");
      const b = addUnit("A");
      store().selectPiece(a);
      store().toggleSelectPiece(b);
      expect(store().selectedPieceIds).toEqual([a, b]);
      expect(store().selectedPieceId).toBe(b);
      store().toggleSelectPiece(b);
      expect(store().selectedPieceIds).toEqual([a]);
      expect(store().selectedPieceId).toBe(a);
    });

    it("replaces the selection with a range and keeps the last id primary", () => {
      const a = addUnit("A");
      const b = addUnit("A");
      const c = addUnit("A");
      store().selectPieces([a, b, c]);
      expect(store().selectedPieceIds).toEqual([a, b, c]);
      expect(store().selectedPieceId).toBe(c);
    });

    it("drops a removed piece from the selection", () => {
      const a = addUnit("A");
      const b = addUnit("A");
      store().selectPiece(a);
      store().toggleSelectPiece(b);
      store().removePiece(b);
      expect(store().selectedPieceIds).toEqual([a]);
      expect(store().selectedPieceId).toBe(a);
    });
  });
});
