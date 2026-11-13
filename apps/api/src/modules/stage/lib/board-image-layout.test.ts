import { BOARD_ZONE_LABEL_EN, seatsFor } from "@openrift/shared/board-layout";
import type { BoardDocument, BoardPiece, BoardPlayer } from "@openrift/shared/board-state";
import { emptyBoardDocument, emptyBoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import {
  SEAT_INSET,
  SLOT_CHROME,
  boardHeightUsed,
  labelWidth,
  planBoardImage,
} from "./board-image-layout.js";

const AREA = { width: 1152, height: 440 };

const PLAYERS: readonly BoardPlayer[] = ["A", "B", "C", "D"];

function piece(overrides: Partial<BoardPiece> & { id: string }): BoardPiece {
  return {
    owner: "A",
    zone: { kind: "base" },
    kind: "unit",
    card: { cardId: "00000000-0000-4000-8000-000000000001", name: "Ashe" },
    exhausted: false,
    facedown: false,
    keywords: [],
    damage: 0,
    might: 0,
    buffs: 0,
    highlight: false,
    ...overrides,
  };
}

function fullestBoard(playerCount: number): BoardDocument {
  const pieces = PLAYERS.slice(0, playerCount).flatMap((owner) => [
    piece({ id: `${owner}-r1`, owner, kind: "rune", zone: { kind: "runes" }, exhausted: true }),
    piece({ id: `${owner}-r2`, owner, kind: "rune", zone: { kind: "runes" } }),
    piece({ id: `${owner}-u`, owner }),
    piece({ id: `${owner}-h`, owner, kind: "spell", zone: { kind: "hand" } }),
  ]);
  return {
    ...emptyBoardDocument(),
    playerCount,
    zones: {
      base: true,
      legend: true,
      champion: true,
      runes: true,
      hand: true,
      trash: true,
      banishment: true,
      deck: true,
      chain: true,
      score: true,
    },
    battlefields: [{ card: null }, { card: null }],
    steps: [{ ...emptyBoardStep(playerCount), pieces }],
  };
}

describe("planBoardImage", () => {
  it.each([1, 2, 3, 4])(
    "keeps every seat, zone and label inside the canvas for %i players with every zone on",
    (playerCount) => {
      const document = fullestBoard(playerCount);
      const plan = planBoardImage(document, seatsFor(playerCount), AREA);

      expect(boardHeightUsed(document, plan)).toBeLessThanOrEqual(AREA.height);
      for (const seat of [...plan.seats.top, ...plan.seats.bottom]) {
        expect(seat.x).toBeGreaterThanOrEqual(0);
        expect(seat.x + seat.width).toBeLessThanOrEqual(AREA.width);
        for (const box of seat.slots) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(seat.width - SEAT_INSET);
          expect(labelWidth(box.label, box.labelSize)).toBeLessThanOrEqual(box.width - SLOT_CHROME);
          expect(box.label).toBe(`${seat.player} · ${BOARD_ZONE_LABEL_EN[box.zone]}`);
        }
      }
    },
  );

  it("wraps a narrow seat's zones onto a second row instead of shortening them", () => {
    const plan = planBoardImage(fullestBoard(4), seatsFor(4), AREA);
    expect(plan.slotRows).toBe(2);
  });

  it("keeps a two-player table on one row of zones", () => {
    const plan = planBoardImage(fullestBoard(2), seatsFor(2), AREA);
    expect(plan.slotRows).toBe(1);
  });
});
