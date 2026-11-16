import { describe, expect, it } from "vitest";

import { entryToDropTarget } from "./rule-drop";

describe("entryToDropTarget", () => {
  it("maps each entry kind to the matching id", () => {
    expect(entryToDropTarget({ kind: "card", cardId: "c1" } as never)).toEqual({
      kind: "card",
      cardId: "c1",
    });
    expect(entryToDropTarget({ kind: "printing", printingId: "p1" } as never)).toEqual({
      kind: "printing",
      printingId: "p1",
    });
    expect(entryToDropTarget({ kind: "copy", copyId: "cp1" } as never)).toEqual({
      kind: "copy",
      copyId: "cp1",
    });
  });
});
