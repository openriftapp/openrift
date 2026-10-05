import { describe, expect, it } from "vitest";

import {
  BOARD_REARM_QUIET_MS,
  boardSurveyCounts,
  boardTriggerStart,
  freshBoardCards,
  noteBoardSurvey,
} from "./scan-board-trigger";

const gate = {
  cardInGuide: false,
  settling: false,
  sweeping: false,
};

describe("boardSurveyCounts", () => {
  it("counts a survey of a quiet guide", () => {
    expect(boardSurveyCounts(gate)).toBe(true);
  });

  it("ignores a survey while a card is being aimed", () => {
    expect(boardSurveyCounts({ ...gate, cardInGuide: true })).toBe(false);
  });

  it("ignores surveys while settling or sweeping", () => {
    expect(boardSurveyCounts({ ...gate, settling: true })).toBe(false);
    expect(boardSurveyCounts({ ...gate, sweeping: true })).toBe(false);
  });
});

describe("noteBoardSurvey", () => {
  it("reads once two surveys in a row see several cards", () => {
    const trigger = boardTriggerStart();
    expect(noteBoardSurvey(trigger, 3, 0)).toBe(false);
    expect(noteBoardSurvey(trigger, 3, 1000)).toBe(true);
  });

  it("does not read when the cards disappear between surveys", () => {
    const trigger = boardTriggerStart();
    noteBoardSurvey(trigger, 3, 0);
    noteBoardSurvey(trigger, 1, 1000);
    expect(noteBoardSurvey(trigger, 3, 2000)).toBe(false);
  });

  it("does not read the same view again until it held fewer than two cards", () => {
    const trigger = boardTriggerStart();
    noteBoardSurvey(trigger, 3, 0);
    noteBoardSurvey(trigger, 3, 1000);
    expect(noteBoardSurvey(trigger, 3, 2000)).toBe(false);
    expect(noteBoardSurvey(trigger, 3, 3000)).toBe(false);
    noteBoardSurvey(trigger, 0, 4000);
    noteBoardSurvey(trigger, 0, 4000 + BOARD_REARM_QUIET_MS);
    noteBoardSurvey(trigger, 3, 6000);
    expect(noteBoardSurvey(trigger, 3, 7000)).toBe(true);
  });
});

describe("freshBoardCards", () => {
  const cards = (...artKeys: string[]) => artKeys.map((artKey) => ({ artKey }));

  it("drops cards an earlier read added while the view never emptied", () => {
    const trigger = boardTriggerStart();
    expect(freshBoardCards(trigger, cards("a", "b"))).toHaveLength(2);
    noteBoardSurvey(trigger, 1, 1000);
    noteBoardSurvey(trigger, 1, 1000 + BOARD_REARM_QUIET_MS);
    expect(freshBoardCards(trigger, cards("a", "b", "c"))).toEqual(cards("c"));
  });

  it("reads the same cards again after an empty view", () => {
    const trigger = boardTriggerStart();
    freshBoardCards(trigger, cards("a", "b"));
    noteBoardSurvey(trigger, 0, 1000);
    expect(freshBoardCards(trigger, cards("a", "b"))).toHaveLength(2);
  });
});
