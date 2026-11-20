import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exportAsync, encodeAsync, copyPendingText } = vi.hoisted(() => ({
  exportAsync: vi.fn(),
  encodeAsync: vi.fn(),
  copyPendingText: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useExportDeck: () => ({ mutateAsync: exportAsync }),
  useEncodeDeckCards: () => ({ mutateAsync: encodeAsync }),
}));
vi.mock("@/hooks/use-copy-to-clipboard", () => ({ copyPendingText }));

const { useDeckCopy } = await import("./use-deck-copy");

const CARDS = [{ cardId: "c-1", zone: "main", quantity: 3 }] as never;

async function refuse(text: Promise<string>): Promise<boolean> {
  try {
    await text;
  } catch {
    return false;
  }
  return false;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useDeckCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyPendingText.mockImplementation(async (text: Promise<string>) => {
      await text;
      return true;
    });
  });

  it("exports a saved deck by id and starts the clipboard write before the code arrives", async () => {
    exportAsync.mockResolvedValue({ code: "ABC", warnings: [] });
    const { result } = renderHook(() => useDeckCopy(() => ({ deckId: "deck-1" })));

    act(() => result.current.copy("piltover"));
    expect(copyPendingText).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Deck code copied"));

    expect(exportAsync).toHaveBeenCalledWith({ deckId: "deck-1", format: "piltover" });
    await expect(copyPendingText.mock.calls[0]?.[0]).resolves.toBe("ABC");
  });

  it("encodes a deck from its cards when there is no saved row", async () => {
    encodeAsync.mockResolvedValue({ code: "Main: 3 Yasuo", warnings: [] });
    const { result } = renderHook(() => useDeckCopy(() => ({ cards: CARDS })));

    act(() => result.current.copy("text"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Text list copied"));

    expect(encodeAsync).toHaveBeenCalledWith({ format: "text", cards: CARDS });
  });

  it("links the TTS mod from the confirmation", async () => {
    encodeAsync.mockResolvedValue({ code: "OGN-001", warnings: [] });
    const { result } = renderHook(() => useDeckCopy(() => ({ cards: CARDS })));

    act(() => result.current.copy("tts"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Tabletop Simulator codes copied", {
        action: { label: "How to load in TTS", onClick: expect.any(Function) },
      }),
    );
  });

  it("hands the text to the fallback when the clipboard refuses it", async () => {
    encodeAsync.mockResolvedValue({ code: "ABC", warnings: [] });
    copyPendingText.mockImplementation(refuse);
    const { result } = renderHook(() => useDeckCopy(() => ({ cards: CARDS })));

    act(() => result.current.copy("piltover"));
    await waitFor(() =>
      expect(result.current.fallback).toEqual({ format: "piltover", text: "ABC" }),
    );
    expect(toast.success).not.toHaveBeenCalled();

    act(() => result.current.closeFallback());
    expect(result.current.fallback).toBeNull();
  });

  it("lists the cards the code left out", async () => {
    encodeAsync.mockResolvedValue({ code: "ABC", warnings: ["Teemo", "Jinx"] });
    const { result } = renderHook(() => useDeckCopy(() => ({ cards: CARDS })));

    act(() => result.current.copy("piltover"));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(expect.any(String), {
        description: "Teemo Jinx",
      }),
    );
  });

  it("opens no fallback when the encoder rejects, which the global handler reports", async () => {
    encodeAsync.mockRejectedValue(new Error("nope"));
    copyPendingText.mockImplementation(refuse);
    const { result } = renderHook(() => useDeckCopy(() => ({ cards: CARDS })));

    act(() => result.current.copy("piltover"));
    await settle();
    await settle();

    expect(result.current.fallback).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
