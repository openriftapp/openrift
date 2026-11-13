import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import { EMPTY_TRADE_PREFERENCE } from "@/test/factories";

import { ruleBadgeAction, ruleMenuAction } from "./rule-entry-actions";

const BASE = {
  id: null,
  listId: "list-1",
  quantity: 1,
  ruleQuantity: 1,
  tradeOverride: EMPTY_TRADE_PREFERENCE,
  source: "rule",
  cardName: "Ionian Sentry",
} as const;

const copyEntry: ListEntryDetailResponse = {
  ...BASE,
  kind: "copy",
  copyId: "copy-1",
  printingId: "printing-1",
  setId: "set-1",
  rarity: "rare",
  finish: "foil",
  shortCode: "OGN-001",
  language: "EN",
  imageId: null,
  reserved: false,
  onLoan: false,
};

const cardEntry: ListEntryDetailResponse = { ...BASE, kind: "card", cardId: "card-1" };

function captureTargets() {
  const onDropFromRule = vi.fn();
  useCardRowActionsStore.setState((state) => ({
    handlers: { ...state.handlers, onDropFromRule },
  }));
  return onDropFromRule;
}

afterEach(() => {
  useCardRowActionsStore.setState((state) => ({
    handlers: { ...state.handlers, onDropFromRule: undefined },
  }));
});

describe("ruleBadgeAction", () => {
  it("keeps a rule-made copy on a tradelist", () => {
    const onDropFromRule = captureTargets();
    const action = ruleBadgeAction(copyEntry, "trade");
    expect(action).toEqual({
      keep: { handleKeep: expect.any(Function), label: "Keep this copy of Ionian Sentry" },
    });
    action.keep?.handleKeep();
    expect(onDropFromRule).toHaveBeenCalledWith({ kind: "copy", copyId: "copy-1" });
  });

  it("leaves a rule-made copy out of an organize list", () => {
    expect(ruleBadgeAction(copyEntry, "organize")).toMatchObject({
      keep: { label: "Leave this copy of Ionian Sentry out" },
    });
  });

  it("excludes a rule-made card", () => {
    const onDropFromRule = captureTargets();
    const action = ruleBadgeAction(cardEntry, "trade");
    expect(action).toMatchObject({ excludeLabel: "Don't include Ionian Sentry" });
    action.onExclude?.();
    expect(onDropFromRule).toHaveBeenCalledWith({ kind: "card", cardId: "card-1" });
  });
});

describe("ruleMenuAction", () => {
  it("labels the menu item by the list's intent", () => {
    expect(ruleMenuAction(copyEntry, "trade")).toMatchObject({ keep: { label: "Keep this copy" } });
    expect(ruleMenuAction(copyEntry, "organize")).toMatchObject({
      keep: { label: "Leave this copy out" },
    });
    expect(ruleMenuAction(cardEntry, "trade")).toEqual({ onExclude: expect.any(Function) });
  });
});

describe("reserved copies", () => {
  it("offers no keep action for a copy already promised to a trade", () => {
    const reserved = { ...copyEntry, reserved: true };
    expect(ruleBadgeAction(reserved, "trade")).toEqual({});
    expect(ruleMenuAction(reserved, "trade")).toEqual({});
  });
});
