import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isLocal: false,
  clone: vi.fn(),
  update: vi.fn(),
  duplicateLocalDeck: vi.fn(() => "copy-id"),
}));

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useCloneDeck: () => ({ mutate: state.clone }),
  useUpdateDeckMeta: () => ({ update: state.update, isPending: false }),
}));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({
  useIsLocalDeck: () => state.isLocal,
}));
vi.mock("@/features/decks/lib/local-decks-collection", () => ({
  duplicateLocalDeck: state.duplicateLocalDeck,
}));

const { useDeckMenuActions } = await import("./use-deck-menu-actions");

function actions() {
  return renderHook(() => useDeckMenuActions({ id: "deck-1", name: "Ahri Mid" })).result.current;
}

describe("useDeckMenuActions", () => {
  beforeEach(() => {
    state.clone.mockClear();
    state.update.mockClear();
    state.duplicateLocalDeck.mockClear();
  });

  it("clones a saved deck on the server", () => {
    state.isLocal = false;
    actions().duplicate();
    expect(state.clone).toHaveBeenCalledWith("deck-1", expect.anything());
    expect(state.duplicateLocalDeck).not.toHaveBeenCalled();
  });

  it("copies a browser-local deck in the browser", () => {
    state.isLocal = true;
    actions().duplicate();
    expect(state.duplicateLocalDeck).toHaveBeenCalledWith("deck-1");
    expect(state.clone).not.toHaveBeenCalled();
  });

  it("writes a format change through the deck's own store", () => {
    actions().changeFormat("freeform", "Freeform");
    expect(state.update).toHaveBeenCalledWith({ format: "freeform" }, expect.anything());
  });
});
