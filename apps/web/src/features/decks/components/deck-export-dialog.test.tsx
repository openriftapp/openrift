import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

const { exportMock, encodeMock, deckCardsMock } = vi.hoisted(() => ({
  exportMock: vi.fn(),
  encodeMock: vi.fn(),
  deckCardsMock: vi.fn(),
}));

function stubMutation(mutate: ReturnType<typeof vi.fn>) {
  return {
    mutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    variables: undefined,
  };
}

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useExportDeck: () => stubMutation(exportMock),
  useEncodeDeckCards: () => stubMutation(encodeMock),
}));

vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckCards: (deckId: string) => deckCardsMock(deckId),
}));

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copied: false, copy: vi.fn(), reset: vi.fn() }),
}));

import { DeckExportDialog } from "./deck-export-dialog";

const cards = [stubDeckBuilderCard({ cardId: "card-1", cardName: "Yasuo", quantity: 3 })];

describe("DeckExportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deckCardsMock.mockReturnValue([]);
  });

  it("exports a server deck through the owner endpoint", async () => {
    render(<DeckExportDialog deckId="deck-1" isDirty={false} open onOpenChange={vi.fn()} />);
    await screen.findByRole("dialog");

    expect(exportMock).toHaveBeenCalledWith(
      { deckId: "deck-1", format: "text" },
      expect.anything(),
    );
    expect(encodeMock).not.toHaveBeenCalled();
  });

  it("encodes a public deck's cards instead of exporting a row the viewer can't read", async () => {
    render(
      <DeckExportDialog
        deckId="deck-1"
        isDirty={false}
        open
        onOpenChange={vi.fn()}
        cards={cards}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    await screen.findByRole("dialog");

    expect(exportMock).not.toHaveBeenCalled();
    expect(encodeMock).toHaveBeenCalledWith(
      {
        format: "text",
        cards: [expect.objectContaining({ cardId: "card-1", quantity: 3 })],
      },
      expect.anything(),
    );
  });

  it("adds the chosen inferred cards, marked as guesses, only once the reader picks them", async () => {
    const inferredCards = [
      stubDeckBuilderCard({ cardId: "card-yi", cardName: "Master Yi", zone: "champion" }),
    ];
    render(
      <DeckExportDialog
        deckId="deck-1"
        isDirty={false}
        open
        onOpenChange={vi.fn()}
        cards={cards}
        extraOptions={[
          { label: "With inferred champion", description: "Adds Master Yi.", cards: inferredCards },
        ]}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    await screen.findByRole("dialog");
    expect(encodeMock).toHaveBeenLastCalledWith(
      { format: "text", cards: [expect.objectContaining({ cardId: "card-1" })] },
      expect.anything(),
    );

    await userEvent.click(screen.getByRole("radio", { name: /With inferred champion/u }));

    expect(encodeMock).toHaveBeenLastCalledWith(
      {
        format: "text",
        cards: [
          expect.objectContaining({ cardId: "card-1" }),
          expect.objectContaining({ cardId: "card-yi", inferred: true }),
        ],
      },
      expect.anything(),
    );
  });

  it("offers no inferred option on a deck without guesses", async () => {
    render(
      <DeckExportDialog
        deckId="deck-1"
        isDirty={false}
        open
        onOpenChange={vi.fn()}
        cards={cards}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    await screen.findByRole("dialog");

    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("says the deck has nothing to export when the code comes back empty", async () => {
    exportMock.mockImplementationOnce(
      (_input: unknown, { onSuccess }: { onSuccess: (data: unknown) => void }) => {
        onSuccess({ code: "", warnings: [] });
      },
    );
    render(<DeckExportDialog deckId="deck-1" isDirty={false} open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("This deck has no cards to export yet.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("never subscribes the editor draft when the caller brings its own cards", async () => {
    render(
      <DeckExportDialog
        deckId="deck-1"
        isDirty={false}
        open
        onOpenChange={vi.fn()}
        cards={cards}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    await screen.findByRole("dialog");

    expect(deckCardsMock).toHaveBeenCalledWith("");
    expect(deckCardsMock).not.toHaveBeenCalledWith("deck-1");
  });
});
