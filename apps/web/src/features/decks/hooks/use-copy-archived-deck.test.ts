import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const cloneMutateAsync = vi.fn();
let userId: string | null = null;

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useCloneSharedDeck: () => ({ mutateAsync: cloneMutateAsync, isPending: false }),
}));
vi.mock("@/lib/auth-session", () => ({ useUserId: () => userId }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { useCopyArchivedDeck } = await import("./use-copy-archived-deck");
const { getLocalDecksCollection, preloadLocalDecks } =
  await import("@/features/decks/lib/local-decks-collection");

await preloadLocalDecks();

function storedDecks() {
  return getLocalDecksCollection().toArray;
}

function clearLocalDecks() {
  const rows = storedDecks();
  if (rows.length > 0) {
    getLocalDecksCollection().delete(rows.map((deck) => deck.id));
  }
}

const TOKEN = "aB3dE5gH7jK9";
const NAME = "Azir, Emperor of the Sands (Ana)";
const DESCRIPTION = "Ana played this deck at Summoner Skirmish.";

const deck = {
  format: "custom-region",
  name: "Azir Control",
  formatConfig: { tagSlugs: ["shurima"] },
  links: [{ label: "Primer", url: "https://example.invalid/primer" }],
} as unknown as MetaDeckDetailResponse["deck"];

const cards = [
  { zone: "legend", cardId: "card-legend", quantity: 1, preferredPrintingId: "printing-legend" },
  { zone: "main", cardId: "card-a", quantity: 3, preferredPrintingId: null },
] as unknown as MetaDeckDetailResponse["cards"];

describe("useCopyArchivedDeck", () => {
  beforeEach(() => {
    clearLocalDecks();
    navigate.mockReset();
    cloneMutateAsync.mockReset();
    userId = null;
  });

  it("labels the copy as opening the builder for a signed-out reader", () => {
    const { result } = renderHook(() => useCopyArchivedDeck());

    expect(result.current.label).toBe("Open in deck builder");
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("labels the copy as copying for a signed-in reader", () => {
    userId = "user-1";
    const { result } = renderHook(() => useCopyArchivedDeck());

    expect(result.current.label).toBe("Copy to my decks");
    expect(result.current.isLoggedIn).toBe(true);
  });

  it("builds a browser-local deck with the archived cards when signed out", async () => {
    const { result } = renderHook(() => useCopyArchivedDeck());

    await result.current.copy({ token: TOKEN, deck, cards, name: NAME, description: DESCRIPTION });

    const stored = storedDecks();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe(NAME);
    expect(stored[0]?.description).toBe(DESCRIPTION);
    expect(stored[0]?.format).toBe("custom-region");
    expect(stored[0]?.cards).toEqual([
      {
        zone: "legend",
        cardId: "card-legend",
        quantity: 1,
        preferredPrintingId: "printing-legend",
      },
      { zone: "main", cardId: "card-a", quantity: 3, preferredPrintingId: null },
    ]);
    expect(cloneMutateAsync).not.toHaveBeenCalled();
  });

  it("carries the format config and links over, so a Custom-Region copy keeps its regions", async () => {
    const { result } = renderHook(() => useCopyArchivedDeck());

    await result.current.copy({ token: TOKEN, deck, cards, name: NAME, description: DESCRIPTION });

    const stored = storedDecks()[0];
    expect(stored?.formatConfig).toEqual({ tagSlugs: ["shurima"] });
    expect(stored?.links).toEqual([{ label: "Primer", url: "https://example.invalid/primer" }]);
  });

  it("navigates to the local deck it just built", async () => {
    const { result } = renderHook(() => useCopyArchivedDeck());

    await result.current.copy({ token: TOKEN, deck, cards, name: NAME, description: DESCRIPTION });

    const localId = storedDecks()[0]?.id;
    expect(navigate).toHaveBeenCalledWith({ to: "/decks/$deckId", params: { deckId: localId } });
  });

  it("clones the deck server-side and opens the copy when signed in", async () => {
    userId = "user-1";
    cloneMutateAsync.mockResolvedValue({ deckId: "deck-9" });
    const { result } = renderHook(() => useCopyArchivedDeck());

    await result.current.copy({ token: TOKEN, deck, cards, name: NAME, description: DESCRIPTION });

    expect(cloneMutateAsync).toHaveBeenCalledWith({
      token: TOKEN,
      name: NAME,
      description: DESCRIPTION,
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/decks/$deckId", params: { deckId: "deck-9" } });
    expect(storedDecks()).toHaveLength(0);
  });

  it("swallows a rejected clone and navigates nowhere", async () => {
    userId = "user-1";
    cloneMutateAsync.mockRejectedValue(new Error("Deck not found"));
    const { result } = renderHook(() => useCopyArchivedDeck());

    await expect(
      result.current.copy({ token: TOKEN, deck, cards, name: NAME, description: DESCRIPTION }),
    ).resolves.toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
