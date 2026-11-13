import type {
  DeckCheckEntryCardResponse,
  PlayerDeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({ formats: [] }),
  useZoneOrder: () => ({
    zoneOrder: ["legend", "champion", "runes", "main", "sideboard"],
    zoneLabels: { legend: "Legend", champion: "Champion", runes: "Runes", main: "Main Deck" },
  }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: {}, printingsByCardId: new Map() }),
}));

vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({}),
}));

const createDeckMutateAsync = vi.fn<(input: unknown) => Promise<{ id: string }>>();
const saveCardsMutateAsync = vi.fn<(input: unknown) => Promise<unknown>>();

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useCreateDeck: () => ({ mutateAsync: createDeckMutateAsync, isPending: false }),
  useSaveDeckCards: () => ({ mutateAsync: saveCardsMutateAsync, isPending: false }),
}));

vi.mock("@/features/tournaments/lib/deck-check-save", () => ({
  deckCardsFromCheckEntry: () => ({ cards: [{ cardId: "c-1", quantity: 1 }], skippedCount: 0 }),
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
}));

const { PlayerCardGrid, SaveToDecksButton } = await import("./player-deck-page");

function card(id: string, zone: string): DeckCheckEntryCardResponse {
  return {
    id,
    zone,
    rawName: `Card ${id}`,
    quantity: 1,
    sortOrder: 0,
    matchStatus: "unmatched",
    resolvedCardId: null,
    resolvedPrintingId: null,
  } as unknown as DeckCheckEntryCardResponse;
}

describe("PlayerCardGrid", () => {
  it("orders the zones by the admin-managed zone order", () => {
    render(
      <PlayerCardGrid cards={[card("a", "main"), card("b", "runes"), card("c", "champion")]} />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Champion · 1", "Runes · 1", "Main Deck · 1"]);
  });
});

describe("SaveToDecksButton", () => {
  it("stays busy across both saves so a second click makes no second deck", async () => {
    createDeckMutateAsync.mockResolvedValue({ id: "deck-1" });
    saveCardsMutateAsync.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const data = {
      entry: { eventName: "Summoner Skirmish", format: "standard" },
      cards: [],
    } as unknown as PlayerDeckCheckEntryDetailResponse;
    render(<SaveToDecksButton data={data} />);

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(createDeckMutateAsync).toHaveBeenCalledTimes(1);
    expect(saveCardsMutateAsync).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});
