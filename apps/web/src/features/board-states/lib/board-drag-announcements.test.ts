import type { Active, Over } from "@dnd-kit/core";
import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import { boardDragAnnouncements } from "./board-drag-announcements";

const yasuo: BoardPiece = {
  id: "p1",
  owner: "A",
  zone: { kind: "base" },
  kind: "unit",
  card: { cardId: "00000000-0000-7000-8000-000000000001", name: "Yasuo, Remorseful" },
  exhausted: false,
  facedown: false,
  keywords: [],
  damage: 0,
  might: 0,
  buffs: 0,
  highlight: false,
};

const step: BoardStep = { ...emptyBoardStep(2), pieces: [yasuo] };
const announcements = boardDragAnnouncements(() => step);

function active(id: string, data: Record<string, unknown>): Active {
  return { id, data: { current: data }, rect: { current: { initial: null, translated: null } } };
}

function over(id: string, data: Record<string, unknown>): Over {
  return {
    id,
    data: { current: data },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const battlefield = over("zone:bf", {
  type: "board-zone",
  zone: { kind: "battlefield", index: 0 },
});

describe("boardDragAnnouncements", () => {
  it("names a piece on the board and the zone it moves to", () => {
    const piece = active("piece:p1", { type: "board-piece", pieceId: "p1" });
    expect(announcements.onDragStart({ active: piece })).toBe("Picked up Yasuo, Remorseful.");
    expect(announcements.onDragEnd({ active: piece, over: battlefield })).toBe(
      "Dropped Yasuo, Remorseful on Battlefield 1.",
    );
  });

  it("names a new piece by its card or its kind", () => {
    expect(
      announcements.onDragStart({
        active: active("new", { type: "board-new-piece", owner: "A", kind: "unit", card: null }),
      }),
    ).toBe("Picked up Unit.");
  });

  it("lets only an arrow end on a piece", () => {
    const target = over("target:p1", { type: "board-piece-target", pieceId: "p1" });
    const arrow = active("arrow", { type: "board-arrow", from: { piece: "p1" } });
    expect(announcements.onDragStart({ active: arrow })).toBe(
      "Picked up Arrow from Yasuo, Remorseful (A).",
    );
    expect(announcements.onDragEnd({ active: arrow, over: target })).toBe(
      "Dropped Arrow from Yasuo, Remorseful (A) on Yasuo, Remorseful.",
    );

    const piece = active("piece:p1", { type: "board-piece", pieceId: "p1" });
    expect(announcements.onDragEnd({ active: piece, over: target })).toBe(
      "Dropped Yasuo, Remorseful. Nothing moved.",
    );
  });
});
