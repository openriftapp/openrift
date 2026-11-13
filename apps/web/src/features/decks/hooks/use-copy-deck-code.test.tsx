import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const copy = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useEncodeDeckCards: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-copy-to-clipboard", () => ({ useCopyToClipboard: () => ({ copy }) }));

const { useCopyDeckCode } = await import("./use-copy-deck-code");

const CARDS = [{ cardId: "c-1", zone: "main", quantity: 3 }] as never;

describe("useCopyDeckCode", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    copy.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.warning).mockClear();
  });

  it("encodes the cards, copies the code and confirms it", async () => {
    mutateAsync.mockResolvedValue({ code: "ABC", warnings: [] });
    copy.mockResolvedValue(true);
    const { result } = renderHook(() => useCopyDeckCode(CARDS));

    await act(() => result.current.copyCode());

    expect(mutateAsync).toHaveBeenCalledWith({ cards: CARDS });
    expect(copy).toHaveBeenCalledWith("ABC");
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("says so when the clipboard refuses the code", async () => {
    mutateAsync.mockResolvedValue({ code: "ABC", warnings: [] });
    copy.mockResolvedValue(false);
    const { result } = renderHook(() => useCopyDeckCode(CARDS));

    await act(() => result.current.copyCode());

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("lists the cards the code left out", async () => {
    mutateAsync.mockResolvedValue({ code: "ABC", warnings: ["Teemo", "Jinx"] });
    copy.mockResolvedValue(true);
    const { result } = renderHook(() => useCopyDeckCode(CARDS));

    await act(() => result.current.copyCode());

    expect(toast.warning).toHaveBeenCalledWith(expect.any(String), { description: "Teemo Jinx" });
  });

  it("copies nothing when encoding fails", async () => {
    mutateAsync.mockRejectedValue(new Error("Encoding failed"));
    const { result } = renderHook(() => useCopyDeckCode(CARDS));

    await act(() => result.current.copyCode());

    expect(copy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
