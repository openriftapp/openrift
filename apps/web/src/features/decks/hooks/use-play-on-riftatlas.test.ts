import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { exportMutate, encodeMutate } = vi.hoisted(() => ({
  exportMutate: vi.fn(),
  encodeMutate: vi.fn(),
}));

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useExportDeck: () => ({ mutate: exportMutate }),
  useEncodeDeckCards: () => ({ mutate: encodeMutate }),
}));

const { usePlayOnRiftAtlas } = await import("./use-play-on-riftatlas");

interface Callbacks {
  onSuccess: (data: { code: string }) => void;
  onError: () => void;
}

function stubTab() {
  return { opener: {} as unknown, location: { href: "about:blank" }, close: vi.fn() };
}

describe("usePlayOnRiftAtlas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the tab inside the click and points it at the deck code once it arrives", () => {
    const tab = stubTab();
    const open = vi.fn(() => tab);
    vi.stubGlobal("open", open);
    const { result } = renderHook(() => usePlayOnRiftAtlas(() => ({ deckId: "deck-1" })));

    result.current();

    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.opener).toBeNull();
    expect(exportMutate).toHaveBeenCalledWith(
      { deckId: "deck-1", format: "piltover" },
      expect.anything(),
    );
    const [, callbacks] = exportMutate.mock.calls[0] as [unknown, Callbacks];
    callbacks.onSuccess({ code: "AB+C/1" });
    expect(tab.location.href).toBe("https://play.riftatlas.com/?deckCode=AB%2BC%2F1");
  });

  it("encodes a deck without a saved row from its cards", () => {
    vi.stubGlobal("open", vi.fn(stubTab));
    const cards = [{ cardId: "c-1", zone: "main", quantity: 3 }] as never;
    const { result } = renderHook(() => usePlayOnRiftAtlas(() => ({ cards })));

    result.current();

    expect(encodeMutate).toHaveBeenCalledWith({ format: "piltover", cards }, expect.anything());
    expect(exportMutate).not.toHaveBeenCalled();
  });

  it("closes the placeholder tab when the code fails", () => {
    const tab = stubTab();
    vi.stubGlobal(
      "open",
      vi.fn(() => tab),
    );
    const { result } = renderHook(() => usePlayOnRiftAtlas(() => ({ deckId: "deck-1" })));

    result.current();
    const [, callbacks] = exportMutate.mock.calls[0] as [unknown, Callbacks];
    callbacks.onError();

    expect(tab.close).toHaveBeenCalledTimes(1);
  });

  it("asks for no code when the popup blocker stops the tab", () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    const { result } = renderHook(() => usePlayOnRiftAtlas(() => ({ deckId: "deck-1" })));

    result.current();

    expect(exportMutate).not.toHaveBeenCalled();
  });
});
