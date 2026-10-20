import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WishEntryFlat } from "@/features/groups/lib/wish-entry";
import { stubPrinting } from "@/test/factories";

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useRemoveListEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateListEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { TakeWishlistFollowUpDialog } = await import("./take-wishlist-followup-dialog");

const bird = stubPrinting({
  printingId: "pair",
  side: 1,
  cardId: "bird",
  card: { name: "Bird" },
  otherSide: { faceId: "f", cardId: "gold", cardName: "Gold", cardSlug: "gold", shortCode: "T-05" },
});

function wish(entryId: string, cardId: string): WishEntryFlat {
  return { entryId, listId: "list-1", listName: "Wants", kind: "card", cardId, quantity: 1 };
}

describe("TakeWishlistFollowUpDialog", () => {
  it("names the card of each wish a double-sided copy meets on one list", () => {
    render(
      <TakeWishlistFollowUpDialog
        printing={bird}
        entries={[wish("e-bird", "bird"), wish("e-gold", "gold")]}
        takenQuantity={1}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("Wants · Bird")).toBeInTheDocument();
    expect(screen.getByText("Wants · Gold")).toBeInTheDocument();
  });

  it("names only the list when every wish is for the same card", () => {
    render(
      <TakeWishlistFollowUpDialog
        printing={bird}
        entries={[wish("e-1", "bird"), { ...wish("e-2", "bird"), listName: "Deck" }]}
        takenQuantity={1}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("Wants")).toBeInTheDocument();
    expect(screen.getByText("Deck")).toBeInTheDocument();
  });

  it("names only the list for a single-sided copy with card and printing wishes", () => {
    const plain = stubPrinting({ printingId: "solo", cardId: "bird", card: { name: "Bird" } });
    render(
      <TakeWishlistFollowUpDialog
        printing={plain}
        entries={[
          wish("e-card", "bird"),
          {
            entryId: "e-printing",
            listId: "list-2",
            listName: "Deck",
            kind: "printing",
            quantity: 1,
          },
        ]}
        takenQuantity={1}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("Wants")).toBeInTheDocument();
    expect(screen.getByText("Deck")).toBeInTheDocument();
  });
});
