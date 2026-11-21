import { sleep } from "@openrift/shared/async";
import { deckCardKey } from "@openrift/shared/deck-cards";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckBoxPlan } from "@/features/decks/lib/deck-box";
import { useDeckBoxOriginsStore } from "@/features/decks/stores/deck-box-origins-store";
import { stubDeckBuilderCard, stubPrinting } from "@/test/factories";
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
const addMutate = vi.fn((_input: unknown) => Promise.resolve([]));
const disposeMutate = vi.fn();
const disposeAsync = vi.fn((_input: unknown) => Promise.resolve());
vi.mock("@/features/collections/hooks/use-copies", () => ({
  useMoveCopies: () => ({ mutate, isPending: false }),
  useAddCopies: () => ({ mutateAsync: addMutate }),
  useDisposeCopies: () => ({ mutate: disposeMutate, mutateAsync: disposeAsync }),
}));
const printingsByCardId = vi.hoisted(() => new Map<string, unknown[]>());
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsByCardId }),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
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
    addMutate.mockClear();
    disposeMutate.mockClear();
    disposeAsync.mockClear();
    toastSuccess.mockClear();
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

  describe("adding as you pack", () => {
    const deckCard = stubDeckBuilderCard({
      cardId: "card-1",
      cardName: "Jinx",
      preferredPrintingId: "printing-1",
    });
    const cardKey = deckCardKey(deckCard);
    const tab = () => (
      <DeckBoxTab
        deckId="deck-1"
        cards={[deckCard]}
        homeCollectionId="box"
        homeCollectionName="Deck box"
        missingCount={1}
        sortCards={(zoneCards) => zoneCards}
        groupCards={(zoneCards) => [{ key: "unit", label: null, cards: zoneCards }]}
        groupBy="type"
        groupDir="asc"
        setOrder={[]}
      />
    );
    const missingSlot = { key: "s:0", cardId: "card-1", cardKey, alternatives: [] };
    const createdCopy = (copyId: string) => ({
      ...plan.extras[0]!.copies[0]!,
      copyId,
      collectionId: "box",
      collectionName: "Deck box",
    });

    beforeEach(() => {
      printingsByCardId.set("card-1", [
        stubPrinting({ printingId: "printing-1", cardId: "card-1", card: { name: "Jinx" } }),
      ]);
    });
    afterEach(() => printingsByCardId.clear());

    function tickToAdd(): string {
      fireEvent.click(screen.getByRole("button", { name: /Add them as you pack/u }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Add a copy of Jinx" }));
      const input = addMutate.mock.lastCall?.[0] as { copies: { id: string }[] };
      return input.copies[0]!.id;
    }

    function asNewInBox(view: ReturnType<typeof render>, id: string) {
      plan.slots = [{ ...missingSlot, state: "in-box", copy: createdCopy(id) }];
      view.rerender(tab());
    }

    it("offers no tick on an unowned slot until add mode is on", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      render(tab());
      expect(screen.queryByRole("checkbox", { name: "Add a copy of Jinx" })).toBeNull();
      expect(screen.getByText("not owned")).toBeTruthy();
    });

    it("offers no tick when no printing would fill the slot", () => {
      printingsByCardId.clear();
      plan.slots = [{ ...missingSlot, state: "missing" }];
      render(tab());
      fireEvent.click(screen.getByRole("button", { name: /Add them as you pack/u }));
      expect(screen.queryByRole("checkbox", { name: "Add a copy of Jinx" })).toBeNull();
    });

    it("pins the new copy to the row that was ticked", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      render(tab());
      const id = tickToAdd();
      expect(useDeckBox.mock.lastCall?.[3]).toEqual(new Map([["s:0", id]]));
    });

    it("resets add mode when the tab remounts", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      const first = render(tab());
      fireEvent.click(screen.getByRole("button", { name: /Add them as you pack/u }));
      first.unmount();
      render(tab());
      expect(screen.queryByText("Adding as you pack")).toBeNull();
    });

    it("keeps tracking a new copy whose delete failed", async () => {
      disposeAsync.mockRejectedValueOnce(new Error("offline"));
      plan.slots = [{ ...missingSlot, state: "missing" }];
      const view = render(tab());
      const id = tickToAdd();
      asNewInBox(view, id);

      fireEvent.click(screen.getByRole("checkbox", { name: "Remove the new copy of Jinx" }));
      await act(() => sleep(0));

      expect(screen.getByRole("checkbox", { name: "Remove the new copy of Jinx" })).toBeTruthy();
    });

    it("hides the way in when nothing is missing", () => {
      plan.slots = [{ ...missingSlot, state: "in-box", copy: createdCopy("copy-9") }];
      render(tab());
      expect(screen.queryByRole("button", { name: /Add them as you pack/u })).toBeNull();
    });

    it("creates a copy of the deck's printing in the box on a tick", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      render(tab());
      const id = tickToAdd();

      expect(addMutate).toHaveBeenCalledWith({
        copies: [{ id, printingId: "printing-1", collectionId: "box" }],
      });
    });

    it("leaves a failed add out of the session's undo", async () => {
      addMutate.mockRejectedValueOnce(new Error("offline"));
      plan.slots = [{ ...missingSlot, state: "missing" }];
      render(tab());
      tickToAdd();
      await act(() => sleep(0));

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("swaps a new copy's printing by deleting it and adding the picked one", async () => {
      printingsByCardId.set("card-1", [
        stubPrinting({ printingId: "printing-1", cardId: "card-1", shortCode: "OGN-001" }),
        stubPrinting({ printingId: "printing-2", cardId: "card-1", shortCode: "OGN-002" }),
      ]);
      plan.slots = [{ ...missingSlot, state: "missing" }];
      const view = render(tab());
      const id = tickToAdd();
      asNewInBox(view, id);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Change the printing of Jinx" }));
      await user.click(screen.getByRole("option", { name: /OGN-002/u }));

      expect(disposeAsync).toHaveBeenCalledWith({ copyIds: [id] });
      expect(addMutate).toHaveBeenLastCalledWith({
        copies: [{ id: expect.any(String), printingId: "printing-2", collectionId: "box" }],
      });
    });

    it("deletes a copy it created when its tick is cleared", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      const view = render(tab());
      const id = tickToAdd();
      asNewInBox(view, id);

      fireEvent.click(screen.getByRole("checkbox", { name: "Remove the new copy of Jinx" }));

      expect(disposeAsync).toHaveBeenCalledWith({ copyIds: [id] });
      expect(mutate).not.toHaveBeenCalled();
    });

    it("ends the session on Done with one undo for every copy it added", () => {
      plan.slots = [{ ...missingSlot, state: "missing" }];
      const view = render(tab());
      const id = tickToAdd();
      asNewInBox(view, id);

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(screen.queryByText("Adding as you pack")).toBeNull();
      expect(screen.getByRole("checkbox", { name: "Take Jinx back out of the box" })).toBeTruthy();
      const [message, options] = toastSuccess.mock.lastCall ?? [];
      expect(message).toBe("Added 1 card to Deck box");
      options.action.onClick();
      expect(disposeMutate).toHaveBeenCalledWith({ copyIds: [id] });
    });
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
