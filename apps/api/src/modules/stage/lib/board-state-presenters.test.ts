import { emptyBoardDocument, emptyBoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import type { BoardState } from "../repositories/board-states.js";
import {
  toAdminBoardState,
  toBoardState,
  toFeaturedBoardState,
  toPublicBoardState,
} from "./board-state-presenters.js";

function makeRow(overrides: Partial<BoardState> = {}): BoardState {
  return {
    id: "b0000000-0001-4000-a000-000000000001",
    userId: "a0000000-0001-4000-a000-000000000001",
    title: "Does a stunned unit hold the battlefield?",
    coreRulesVersion: "2026-07-16",
    tournamentRulesVersion: null,
    document: emptyBoardDocument(),
    isPublic: true,
    shareToken: "AbCdEfGhIjKl",
    isFeatured: false,
    createdAt: new Date("2026-09-01T10:30:00.000Z"),
    updatedAt: new Date("2026-09-02T11:00:00.000Z"),
    ...overrides,
  };
}

describe("toBoardState", () => {
  it("maps a row to the owner response shape", () => {
    expect(toBoardState(makeRow())).toEqual({
      id: "b0000000-0001-4000-a000-000000000001",
      title: "Does a stunned unit hold the battlefield?",
      coreRulesVersion: "2026-07-16",
      tournamentRulesVersion: null,
      document: emptyBoardDocument(),
      isPublic: true,
      shareToken: "AbCdEfGhIjKl",
      isFeatured: false,
      createdAt: "2026-09-01T10:30:00.000Z",
      updatedAt: "2026-09-02T11:00:00.000Z",
    });
  });
});

describe("toPublicBoardState", () => {
  it("drops the share token and public flag", () => {
    const result = toPublicBoardState(makeRow());
    expect(result).not.toHaveProperty("shareToken");
    expect(result).not.toHaveProperty("isPublic");
    expect(result).not.toHaveProperty("userId");
  });

  it("summarises the board with its last step's caption", () => {
    const document = emptyBoardDocument();
    const steps = [
      { ...emptyBoardStep(2), caption: "Setup." },
      { ...emptyBoardStep(2), caption: "The defender holds, see [[460.3]]." },
    ];
    expect(toPublicBoardState(makeRow({ document: { ...document, steps } })).summary).toBe(
      "The defender holds, see § 460.3.",
    );
  });

  it("has no summary when the last caption is empty", () => {
    expect(toPublicBoardState(makeRow()).summary).toBeNull();
  });
});

describe("toFeaturedBoardState", () => {
  it("keeps the share token so the list can link to the page", () => {
    expect(toFeaturedBoardState(makeRow({ isFeatured: true }))?.shareToken).toBe("AbCdEfGhIjKl");
  });

  it("returns undefined for a row without a share token", () => {
    expect(toFeaturedBoardState(makeRow({ shareToken: null }))).toBeUndefined();
  });
});

describe("toAdminBoardState", () => {
  it("counts steps and carries the owner name", () => {
    const result = toAdminBoardState({ ...makeRow(), ownerName: "Teemo" });
    expect(result.stepCount).toBe(1);
    expect(result.ownerName).toBe("Teemo");
    expect(result.shareToken).toBe("AbCdEfGhIjKl");
  });

  it("hides a leftover token when sharing is off", () => {
    expect(
      toAdminBoardState({ ...makeRow({ isPublic: false }), ownerName: null }).shareToken,
    ).toBeNull();
  });
});
