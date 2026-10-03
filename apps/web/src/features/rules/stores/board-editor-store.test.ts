import {
  boardDocumentSchema,
  emptyBoardDocument,
  MAX_BOARD_STEPS,
  MAX_CHAIN_ENTRIES,
  MAX_PIECE_BUFFS,
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

    it("remembers picked cards newest first without duplicates", () => {
      const place = (cardId: string) =>
        store().addPiece({
          owner: "A",
          zone: { kind: "base" },
          kind: "unit",
          card: { cardId, name: cardId },
        });
      place("c1");
      place("c2");
      place("c1");
      addUnit();
      expect(store().recentCardIds).toEqual(["c1", "c2"]);
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
      store().addArrow({ kind: "target", from: { piece: a }, to: { piece: b } });
      store().removePiece(b);
      expect(activeStep().pieces.map((piece) => piece.id)).toEqual([a]);
      expect(activeStep().arrows).toEqual([]);
      expect(store().selectedPieceId).toBeNull();
    });

    it("places cards facedown in a deck or a facedown zone and face up elsewhere", () => {
      const deck = store().addPiece({
        owner: "A",
        zone: { kind: "deck" },
        kind: "unit",
        card: null,
      });
      const hidden = store().addPiece({
        owner: "A",
        zone: { kind: "facedown", index: 0 },
        kind: "spell",
        card: null,
      });
      const open = addUnit();
      const facedown = (id: string) => activeStep().pieces.find((p) => p.id === id)!.facedown;
      expect(facedown(deck)).toBe(true);
      expect(facedown(hidden)).toBe(true);
      expect(facedown(open)).toBe(false);
    });

    it("turns a card face up when it leaves a hidden zone and facedown when it enters one", () => {
      const id = store().addPiece({ owner: "A", zone: { kind: "deck" }, kind: "unit", card: null });
      store().movePiece(id, { kind: "hand" });
      expect(activeStep().pieces[0]!.facedown).toBe(false);
      store().movePiece(id, { kind: "runeDeck" });
      expect(activeStep().pieces[0]!.facedown).toBe(true);
    });

    it("keeps a revealed deck card face up while it moves between decks", () => {
      const id = store().addPiece({ owner: "A", zone: { kind: "deck" }, kind: "unit", card: null });
      store().updatePiece(id, { facedown: false });
      store().movePiece(id, { kind: "runeDeck" });
      expect(activeStep().pieces[0]!.facedown).toBe(false);
    });

    it("clamps buffs to zero and the maximum", () => {
      const id = addUnit();
      store().adjustBuffs(id, -1);
      expect(activeStep().pieces[0]!.buffs).toBe(0);
      store().adjustBuffs(id, 2);
      expect(activeStep().pieces[0]!.buffs).toBe(2);
      store().adjustBuffs(id, 50);
      expect(activeStep().pieces[0]!.buffs).toBe(MAX_PIECE_BUFFS);
    });

    it("clears an optional field when the patch sets it to undefined", () => {
      const id = addUnit();
      store().updatePiece(id, { counter: { value: 2, label: "XP" } });
      expect(activeStep().pieces[0]!.counter).toEqual({ value: 2, label: "XP" });
      store().updatePiece(id, { counter: undefined });
      expect(activeStep().pieces[0]).not.toHaveProperty("counter");
    });
  });

  describe("chain", () => {
    it("adds entries with sequential ids", () => {
      expect(store().addChainEntry({ owner: "A", type: "spell", label: "Spell" })).toBe("c1");
      expect(store().addChainEntry({ owner: "B", type: "spell", label: "Counter" })).toBe("c2");
      expect(activeStep().chain.map((entry) => entry.id)).toEqual(["c1", "c2"]);
    });

    it("stops adding entries at the limit", () => {
      for (let i = 0; i < MAX_CHAIN_ENTRIES; i++) {
        store().addChainEntry({ owner: "A", type: "spell", label: `Spell ${i}` });
      }
      expect(store().addChainEntry({ owner: "A", type: "spell", label: "One too many" })).toBe(
        null,
      );
      expect(activeStep().chain).toHaveLength(MAX_CHAIN_ENTRIES);
    });

    it("removes an entry and every arrow from or to it", () => {
      const unit = addUnit();
      const spell = store().addChainEntry({ owner: "A", type: "spell", label: "Spell" })!;
      const counter = store().addChainEntry({ owner: "B", type: "spell", label: "Counter" })!;
      store().addArrow({ kind: "target", from: { chain: spell }, to: { piece: unit } });
      store().addArrow({ kind: "target", from: { chain: counter }, to: { chain: spell } });
      store().removeChainEntry(spell);
      expect(activeStep().chain.map((entry) => entry.id)).toEqual([counter]);
      expect(activeStep().arrows).toEqual([]);
    });

    it("keeps an ability whose source is removed under the source card's name", () => {
      const yasuo = store().addPiece({
        owner: "A",
        zone: { kind: "battlefield", index: 0 },
        kind: "unit",
        card: { cardId: "00000000-0000-7000-8000-000000000001", name: "Yasuo, Remorseful" },
      });
      store().addChainEntry({ owner: "A", type: "triggered", source: yasuo });
      store().removePiece(yasuo);
      expect(activeStep().chain).toEqual([
        { id: "c1", owner: "A", type: "triggered", label: "Yasuo, Remorseful" },
      ]);
      expect(boardDocumentSchema.safeParse(store().document).success).toBe(true);
    });

    it("drops an ability whose cardless source is removed", () => {
      const unit = addUnit();
      store().addChainEntry({ owner: "A", type: "activated", source: unit });
      store().removePiece(unit);
      expect(activeStep().chain).toEqual([]);
    });

    it("clears an entry's label when the patch sets it to undefined", () => {
      const card = { cardId: "00000000-0000-7000-8000-000000000001", name: "Flash Freeze" };
      const id = store().addChainEntry({ owner: "A", type: "spell", label: "Draft", card })!;
      store().updateChainEntry(id, { label: undefined });
      expect(activeStep().chain[0]).toEqual({ id, owner: "A", type: "spell", card });
    });
  });

  describe("step state", () => {
    it("sets and clears turn fields", () => {
      store().setTurn({ player: "A", phase: "main", priority: "B" });
      store().setTurn({ priority: undefined });
      expect(activeStep().turn).toEqual({ player: "A", phase: "main" });
    });

    it("sets player stats and drops a player whose stats are all cleared", () => {
      store().setPlayerStats("A", { score: 3, xp: 1 });
      expect(activeStep().players.A).toEqual({ score: 3, xp: 1 });
      store().setPlayerStats("A", { score: undefined, xp: undefined });
      expect(activeStep().players).toEqual({});
    });

    it("sets battlefield state on the active step only", () => {
      store().addStep();
      store().setBattlefieldState(1, { controller: "B", contested: true });
      expect(activeStep().battlefields[1]).toMatchObject({ controller: "B", contested: true });
      expect(store().document.steps[0]!.battlefields[1]!.controller).toBeNull();
    });

    it("copies turn, stats and battlefield state into a new step", () => {
      store().setTurn({ phase: "draw" });
      store().setPlayerStats("B", { score: 6 });
      store().setBattlefieldState(0, { controller: "A" });
      store().addStep();
      expect(activeStep().turn).toEqual({ phase: "draw" });
      expect(activeStep().players.B).toEqual({ score: 6 });
      expect(activeStep().battlefields[0]!.controller).toBe("A");
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
        type: "spell",
        card: { cardId: "00000000-0000-7000-8000-000000000001", name: "Spell" },
      });
      store().setPlayerCount(2);
      expect(activeStep().pieces.map((piece) => piece.owner)).toEqual(["A"]);
      expect(activeStep().chain).toEqual([]);
    });

    it("clears every trace of removed players and keeps the document valid", () => {
      store().setPlayerCount(4);
      const a = addUnit("A");
      const d = addUnit("D");
      store().addArrow({ kind: "target", from: { piece: a }, to: { piece: d } });
      store().addChainEntry({ owner: "A", type: "triggered", source: d });
      store().setScoring("teams");
      store().setTurn({ player: "D", priority: "A", focus: "C" });
      store().setPlayerStats("C", { xp: 2 });
      store().setBattlefieldState(0, { controller: "D", scoredBy: ["A", "D"] });
      store().setPlayerCount(2);
      const step = activeStep();
      expect(store().document.scoring).toBe("players");
      expect(step.arrows).toEqual([]);
      expect(step.chain).toEqual([]);
      expect(step.turn).toEqual({ priority: "A" });
      expect(step.players).toEqual({});
      expect(step.battlefields[0]).toMatchObject({ controller: null, scoredBy: ["A"] });
      expect(boardDocumentSchema.safeParse(store().document).success).toBe(true);
    });

    it("allows team scoring only with four players and moves no score onto C or D", () => {
      store().setScoring("teams");
      expect(store().document.scoring).toBe("players");
      store().setPlayerCount(4);
      store().setPlayerStats("C", { score: 4, xp: 1 });
      store().setScoring("teams");
      expect(store().document.scoring).toBe("teams");
      expect(activeStep().players.C).toEqual({ xp: 1 });
    });

    it("drops facedown pieces and battlefield state of removed battlefields", () => {
      store().setBattlefieldCount(3);
      store().addPiece({
        owner: "A",
        zone: { kind: "facedown", index: 2 },
        kind: "spell",
        card: null,
      });
      store().setBattlefieldState(2, { controller: "A" });
      store().setBattlefieldCount(2);
      expect(activeStep().pieces).toEqual([]);
      expect(activeStep().battlefields).toHaveLength(2);
      store().setBattlefieldCount(3);
      expect(activeStep().battlefields[2]!.controller).toBeNull();
      expect(boardDocumentSchema.safeParse(store().document).success).toBe(true);
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
    store().addArrow({
      kind: "move",
      from: { piece: a },
      to: { zone: { kind: "base" }, owner: "A" },
    });
    store().addArrow({
      kind: "recall",
      from: { piece: d },
      to: { zone: { kind: "base" }, owner: "D" },
    });
    const spell = store().addChainEntry({ owner: "B", type: "spell", label: "Hypothetical" })!;
    store().addArrow({ kind: "target", from: { chain: spell }, to: { piece: a } });
    store().addStep();
    store().updatePiece(d, { exhausted: true });
    store().removeArrow(0);
    store().setScoring("teams");
    store().setPlayerStats("A", { score: 7, power: { fury: 1 } });
    store().setTurn({ player: "A", phase: "main", state: "showdown-open", focus: "B" });
    store().setBattlefieldState(1, { contested: true, encounter: "combat", scoredBy: ["D"] });
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
