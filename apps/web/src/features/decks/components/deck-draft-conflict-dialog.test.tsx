import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDeckDraftCollection,
  getDeckDraftHasConflict,
  syncDeckDraft,
} from "@/features/decks/stores/deck-draft-store";
import { stubDeckBuilderCard } from "@/test/factories";

import { DeckDraftConflictDialog } from "./deck-draft-conflict-dialog";

vi.mock("@/features/decks/hooks/use-deck-draft", () => ({
  useDeckDraftScope: () => "user-1",
}));
vi.mock("@/features/decks/lib/decks-write", () => ({
  saveDeckCards: () => ({ when: () => Promise.resolve() }),
}));
vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDeckCardsCollection: () => ({ preload: () => Promise.resolve() }),
}));

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderWithConflict(deckId: string) {
  const viktor = stubDeckBuilderCard({ cardId: "viktor" });
  syncDeckDraft(queryClient, "user-1", deckId, [viktor]);
  render(
    <QueryClientProvider client={queryClient}>
      <DeckDraftConflictDialog deckId={deckId} />
    </QueryClientProvider>,
  );
  act(() => {
    getDeckDraftCollection(queryClient, "user-1", deckId).insert(
      stubDeckBuilderCard({ cardId: "ahri" }),
    );
    syncDeckDraft(queryClient, "user-1", deckId, [viktor, stubDeckBuilderCard({ cardId: "jinx" })]);
  });
}

describe("DeckDraftConflictDialog", () => {
  it("keeps the player's version when they choose it", async () => {
    renderWithConflict("deck-keep");

    await userEvent.click(screen.getByRole("button", { name: "Keep my version" }));

    expect(getDeckDraftHasConflict(queryClient, "user-1", "deck-keep")).toBe(false);
    expect(getDeckDraftCollection(queryClient, "user-1", "deck-keep").has("ahri|main|")).toBe(true);
  });

  it("loads the saved version when they choose it", async () => {
    renderWithConflict("deck-load");

    await userEvent.click(screen.getByRole("button", { name: "Load saved version" }));

    expect(getDeckDraftHasConflict(queryClient, "user-1", "deck-load")).toBe(false);
    expect(getDeckDraftCollection(queryClient, "user-1", "deck-load").has("jinx|main|")).toBe(true);
    expect(getDeckDraftCollection(queryClient, "user-1", "deck-load").has("ahri|main|")).toBe(
      false,
    );
  });
});
