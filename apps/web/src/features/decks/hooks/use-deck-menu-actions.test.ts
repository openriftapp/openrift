import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isLocal: false,
  clone: vi.fn(),
  update: vi.fn(),
  duplicateLocalDeck: vi.fn((): string | null => "copy-id"),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
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
    vi.mocked(toast.success).mockClear();
  });

  it("clones a saved deck on the server and announces the copy once it lands", () => {
    state.isLocal = false;
    actions().duplicate();
    expect(state.clone).toHaveBeenCalledWith("deck-1", { onSuccess: expect.any(Function) });
    expect(state.duplicateLocalDeck).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    state.clone.mock.calls[0]?.[1].onSuccess();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Duplicated "Ahri Mid".');
  });

  it("copies a browser-local deck in the browser and announces it", () => {
    state.isLocal = true;
    actions().duplicate();
    expect(state.duplicateLocalDeck).toHaveBeenCalledWith("deck-1");
    expect(state.clone).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Duplicated "Ahri Mid".');
  });

  it("announces nothing when the browser-local copy fails", () => {
    state.isLocal = true;
    state.duplicateLocalDeck.mockReturnValueOnce(null);
    actions().duplicate();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("writes a format change through the deck's own store and announces the new format", () => {
    actions().changeFormat("freeform", "Freeform");
    expect(state.update).toHaveBeenCalledWith(
      { format: "freeform" },
      { onSuccess: expect.any(Function) },
    );
    expect(toast.success).not.toHaveBeenCalled();

    state.update.mock.calls[0]?.[1].onSuccess();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Format changed to Freeform.");
  });
});
