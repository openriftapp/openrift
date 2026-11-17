import { deckCardKey } from "@openrift/shared/deck-cards";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckBoxPlan } from "@/features/decks/lib/deck-box";
import { useDeckBoxOriginsStore } from "@/features/decks/stores/deck-box-origins-store";
import { stubDeckBuilderCard } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => <a {...rest}>{children}</a>,
}));

const plan: DeckBoxPlan = {
  neededTotal: 0,
  inBoxTotal: 0,
  slots: [],
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
          setId: "origins",
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
vi.mock("@/hooks/use-enums", async () => {
  const { useZoneOrderStub } = await import("@/test/zone-order-stub");
  return {
    useZoneOrder: useZoneOrderStub,
    useEnumOrders: () => ({
      labels: { rarities: {}, finishes: {}, artVariants: {}, cardSizes: {}, conditions: {} },
    }),
  };
});

const { DeckBoxTab } = await import("./deck-box-tab");

const resetOrigins = createStoreResetter(useDeckBoxOriginsStore);

function renderTab(onCardClick: () => void, missingCount = 0) {
  render(
    <DeckBoxTab
      deckId="deck-1"
      cards={[]}
      homeCollectionId="box"
      homeCollectionName="Deck box"
      missingCount={missingCount}
      sortCards={(zoneCards) => zoneCards}
      groupCards={() => []}
      groupBy="type"
      groupDir="asc"
      setOrder={[]}
      onCardClick={onCardClick}
    />,
  );
}

describe("DeckBoxTab", () => {
  afterEach(resetOrigins);
  beforeEach(() => {
    resetOrigins();
    mutate.mockClear();
    mdUp.value = true;
    plan.slots = [];
  });

  it("names the deck's missing count on the shopping button, not the box's empty slots", () => {
    plan.slots = [{ key: "x:0", cardId: "x", cardKey: "x", state: "missing", alternatives: [] }];
    renderTab(vi.fn(), 2);
    expect(screen.getByRole("button", { name: "You don't own 2 cards" })).toBeTruthy();
  });

  it("hides the shopping button when nothing is missing", () => {
    plan.slots = [{ key: "x:0", cardId: "x", cardKey: "x", state: "missing", alternatives: [] }];
    renderTab(vi.fn(), 0);
    expect(screen.queryByRole("button", { name: /You don't own/u })).toBeNull();
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
          cardKey: deckCardKey(deckCard),
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
          missingCount={0}
          sortCards={(zoneCards) => zoneCards}
          groupCards={(zoneCards) => [{ key: "unit", label: null, cards: zoneCards }]}
          groupBy="type"
          groupDir="asc"
          setOrder={[]}
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

  it("groups the main deck's rows by the set of each copy, uncovered slots last", () => {
    const [extra] = plan.extras;
    const originsCopy = extra!.copies[0]!;
    const forgedCopy = { ...originsCopy, copyId: "copy-2", setId: "spiritforged" };
    const deckCard = stubDeckBuilderCard({ cardId: "card-1", cardName: "Jinx", quantity: 3 });
    const cardKey = deckCardKey(deckCard);
    plan.slots = [
      {
        key: "s:0",
        cardId: "card-1",
        cardKey,
        state: "in-box",
        copy: forgedCopy,
        alternatives: [],
      },
      {
        key: "s:1",
        cardId: "card-1",
        cardKey,
        state: "in-box",
        copy: originsCopy,
        alternatives: [],
      },
      { key: "s:2", cardId: "card-1", cardKey, state: "missing", alternatives: [] },
    ];
    render(
      <DeckBoxTab
        deckId="deck-1"
        cards={[deckCard]}
        homeCollectionId="box"
        homeCollectionName="Deck box"
        missingCount={1}
        sortCards={(zoneCards) => zoneCards}
        groupCards={(zoneCards) => [{ key: "unit", label: null, cards: zoneCards }]}
        groupBy="set"
        groupDir="asc"
        setOrder={[
          { id: "origins", name: "Origins" },
          { id: "spiritforged", name: "Spiritforged" },
        ]}
      />,
    );

    const headers = ["Origins", "Spiritforged", "Not owned"].map((label) =>
      screen.getByText(label),
    );
    expect(
      headers.every(
        (header, index) =>
          index === 0 ||
          headers[index - 1]!.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("returns a copy to the collection it came from after the tab remounts", () => {
    const [extra] = plan.extras;
    const shelfCopy = extra!.copies[0]!;
    const deckCard = stubDeckBuilderCard({
      cardId: "card-1",
      cardName: "Jinx",
      preferredPrintingId: "printing-1",
    });
    const slot = {
      key: "slot-1",
      cardId: "card-1",
      cardKey: deckCardKey(deckCard),
      copy: shelfCopy,
      alternatives: [],
    };
    const tab = (
      <DeckBoxTab
        deckId="deck-1"
        cards={[deckCard]}
        homeCollectionId="box"
        homeCollectionName="Deck box"
        missingCount={0}
        sortCards={(zoneCards) => zoneCards}
        groupCards={(zoneCards) => [{ key: "unit", label: null, cards: zoneCards }]}
        groupBy="type"
        groupDir="asc"
        setOrder={[]}
      />
    );

    plan.slots = [{ ...slot, state: "available" }];
    const first = render(tab);
    fireEvent.click(screen.getByRole("checkbox", { name: "Put Jinx in the box" }));
    first.unmount();

    plan.slots = [{ ...slot, state: "in-box" }];
    render(tab);
    fireEvent.click(screen.getByRole("checkbox", { name: "Take Jinx back out of the box" }));

    expect(mutate).toHaveBeenLastCalledWith({ copyIds: ["copy-1"], toCollectionId: "shelf" });
  });
});
