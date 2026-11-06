import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckBoxPlan } from "@/features/decks/lib/deck-box";
import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";
import { stubDeckBuilderCard } from "@/test/factories";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => <a {...rest}>{children}</a>,
}));

const plan: DeckBoxPlan = {
  neededTotal: 0,
  inBoxTotal: 0,
  slots: [],
  missingCount: 0,
  extras: [
    {
      card: { cardId: "card-1", name: "Jinx", types: ["unit"], tags: [], domains: ["fury"] },
      copies: [
        {
          copyId: "copy-1",
          printingId: "printing-1",
          shortCode: "OGN-042",
          rarity: "common",
          imageId: null,
          condition: null,
          grade: null,
          collectionId: "shelf",
          collectionName: "Shelf",
          language: "EN",
          artVariant: "standard",
          finish: "standard",
          size: "standard",
          isSigned: false,
          isOvernumbered: false,
          markers: [],
        },
      ],
    },
  ],
  extraCount: 1,
  siblingPrintingsByCardId: new Map(),
};

const mutate = vi.fn();
const mdUp = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => !mdUp.value }));

const useDeckBox = vi.fn((..._args: unknown[]) => plan);
vi.mock("@/features/decks/hooks/use-deck-box", () => ({
  useDeckBox: (...args: unknown[]) => useDeckBox(...args),
}));
vi.mock("@/features/collections/hooks/use-copies", () => ({
  useMoveCopies: () => ({ mutate, isPending: false }),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollections: () => ({ data: [{ id: "inbox", name: "Inbox", isInbox: true }] }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({ fury: "#cb212d" }) }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { rarities: {}, finishes: {}, artVariants: {}, cardSizes: {}, conditions: {} },
  }),
}));

const { DeckBoxTab } = await import("./deck-box-tab");

function renderTab(onCardClick: () => void) {
  render(
    <DeckBoxTab
      deckId="deck-1"
      cards={[]}
      homeCollectionId="box"
      homeCollectionName="Deck box"
      sortCards={(zoneCards) => zoneCards}
      groupCards={() => []}
      groupBy="type"
      onCardClick={onCardClick}
    />,
  );
}

describe("DeckBoxTab", () => {
  beforeEach(() => {
    mutate.mockClear();
    mdUp.value = true;
    plan.slots = [];
  });

  it("opens the card detail when the row itself is clicked", () => {
    const onCardClick = vi.fn();
    renderTab(onCardClick);

    fireEvent.click(screen.getByRole("button", { name: /Jinx/u }));

    expect(onCardClick).toHaveBeenCalledWith({
      cardId: "card-1",
      preferredPrintingId: "printing-1",
    });
  });

  it("sweeps a surplus copy into the inbox when its tick is cleared", () => {
    const onCardClick = vi.fn();
    renderTab(onCardClick);

    fireEvent.click(screen.getByRole("checkbox", { name: "Move Jinx out of the box" }));

    expect(mutate).toHaveBeenCalledWith({ copyIds: ["copy-1"], toCollectionId: "inbox" });
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "swaps the copy from the source picker without opening the row (md up: %s)",
    async (up) => {
      mdUp.value = up;
      const [extra] = plan.extras;
      const shelfCopy = extra!.copies[0]!;
      const binderCopy = {
        ...shelfCopy,
        copyId: "copy-2",
        collectionId: "binder",
        collectionName: "Binder",
      };
      const deckCard = stubDeckBuilderCard({
        cardId: "card-1",
        cardName: "Jinx",
        preferredPrintingId: "printing-1",
      });
      plan.slots = [
        {
          key: "slot-1",
          cardId: "card-1",
          cardKey: getDeckCardKey(deckCard),
          state: "available",
          copy: shelfCopy,
          alternatives: [{ key: "alt-1", copy: binderCopy, count: 1 }],
        },
      ];
      const onCardClick = vi.fn();
      render(
        <DeckBoxTab
          deckId="deck-1"
          cards={[deckCard]}
          homeCollectionId="box"
          homeCollectionName="Deck box"
          sortCards={(zoneCards) => zoneCards}
          groupCards={(zoneCards) => [{ key: "unit", label: null, cards: zoneCards }]}
          groupBy="type"
          onCardClick={onCardClick}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Take a different copy of Jinx" }));
      await user.click(screen.getByRole("option"));

      expect(onCardClick).not.toHaveBeenCalled();
      expect(useDeckBox.mock.lastCall?.[3]).toEqual(new Map([["slot-1", "copy-2"]]));
    },
  );
});
