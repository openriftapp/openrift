import { describe, expect, it, vi } from "vitest";

import {
  combinedUndo,
  discardUndoText,
  goneNotice,
  ignoredUndoText,
  mappedUndoText,
  undoScope,
  usedUndoText,
} from "./workspace-undo";

describe("discardUndoText", () => {
  it("names one image without a count once it is restored", () => {
    expect(
      discardUndoText({ suggestions: 0, images: 1, sources: 1, record: "Teemo, Scout" }),
    ).toEqual({
      label: "Discarded 1 image on Teemo, Scout",
      undoneLabel: "Undone: image restored on Teemo, Scout",
    });
  });

  it("counts suggestions and images together", () => {
    expect(
      discardUndoText({ suggestions: 3, images: 1, sources: 2, record: "Jinx, Demolitionist" }),
    ).toEqual({
      label: "Discarded 3 suggestions and 1 image on Jinx, Demolitionist",
      undoneLabel: "Undone: 3 suggestions and 1 image restored on Jinx, Demolitionist",
    });
  });

  it("falls back to the source count when the sources differ in nothing shown", () => {
    expect(discardUndoText({ suggestions: 0, images: 0, sources: 2, record: "Vi" })).toEqual({
      label: "Discarded 2 sources on Vi",
      undoneLabel: "Undone: 2 sources restored on Vi",
    });
  });
});

describe("usedUndoText", () => {
  it("names the field, the source and the record", () => {
    expect(usedUndoText({ field: "Rarity", source: "Provider A", record: "Vi" })).toEqual({
      label: "Used Rarity from Provider A on Vi",
      undoneLabel: "Undone: Rarity restored on Vi",
    });
  });
});

describe("ignoredUndoText", () => {
  it("names the record once when the record itself was ignored", () => {
    expect(ignoredUndoText({ what: "Ekko", record: "Ekko" })).toEqual({
      label: "Ignored Ekko",
      undoneLabel: "Undone: Ekko is back in the queue",
    });
  });

  it("says the ignored items are back when there are several", () => {
    expect(ignoredUndoText({ what: "3 new cards", record: "3 new cards", plural: true })).toEqual({
      label: "Ignored 3 new cards",
      undoneLabel: "Undone: 3 new cards are back in the queue",
    });
  });

  it("names what was ignored on the record", () => {
    expect(ignoredUndoText({ what: "TCGplayer #12", record: "Ekko" }).label).toBe(
      "Ignored TCGplayer #12 on Ekko",
    );
  });
});

describe("mappedUndoText", () => {
  it("names the listing and the printing", () => {
    expect(mappedUndoText({ listing: "Cardmarket #9", record: "OGN-001" })).toEqual({
      label: "Assigned Cardmarket #9 to OGN-001",
      undoneLabel: "Undone: Cardmarket #9 unassigned from OGN-001",
    });
  });
});

describe("undoScope", () => {
  it("always refreshes the workspace queue", () => {
    expect(undoScope([["admin", "cards"]])).toEqual([
      ["admin", "workspace"],
      ["admin", "cards"],
    ]);
  });
});

describe("combinedUndo", () => {
  it("runs every part and refreshes every part's queries", async () => {
    const first = {
      label: "a",
      undoneLabel: "a",
      invalidates: [["x"]],
      undo: vi.fn(async () => {}),
    };
    const second = {
      label: "b",
      undoneLabel: "b",
      invalidates: [["y"]],
      undo: vi.fn(async () => {}),
    };
    const entry = combinedUndo({ label: "both", undoneLabel: "both back" }, [first, second]);

    await entry.undo();

    expect(entry.label).toBe("both");
    expect(entry.invalidates).toEqual([["x"], ["y"]]);
    expect(first.undo).toHaveBeenCalledOnce();
    expect(second.undo).toHaveBeenCalledOnce();
  });
});

describe("goneNotice", () => {
  it("quotes the label of the dropped entry", () => {
    expect(
      goneNotice({ label: "Ignored Ekko", undoneLabel: "", invalidates: [], undo: async () => {} }),
    ).toBe('Can\'t undo "Ignored Ekko": it was deleted since');
  });
});
