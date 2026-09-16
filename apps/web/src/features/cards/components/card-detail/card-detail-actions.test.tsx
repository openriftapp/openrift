import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const cardId = "card-chaos-rune";
const printingX = stubPrinting({ id: "p-x", cardId, card: { name: "Chaos Rune" } });
const printingY = stubPrinting({ id: "p-y", cardId, card: { name: "Chaos Rune" } });

vi.mock("@/features/cards/components/printing-count-actions", () => ({
  PrintingCountActions: ({
    collectionId,
    siblings,
  }: {
    collectionId?: string;
    siblings?: readonly { id: string }[];
  }) => (
    <span data-testid="stepper" data-collection={collectionId ?? ""}>
      {siblings?.length ?? 0}
    </span>
  ),
}));

vi.mock("@/features/cards/components/wishlist-heart", () => ({
  WishlistButton: ({ cardName, onAdd }: { cardName: string; onAdd: () => void }) => (
    <button type="button" onClick={onAdd}>
      Wishlist {cardName}
    </button>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
const { CardDetailActions } = await import("./card-detail-actions");

describe("CardDetailActions", () => {
  it("renders the stepper and the wishlist button together", () => {
    render(<CardDetailActions printing={printingX} wishEntries={[]} onAddToWishlist={() => {}} />);

    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wishlist Chaos Rune" })).toBeInTheDocument();
  });

  it("keeps the wishlist button when the stepper is hidden", () => {
    render(
      <CardDetailActions
        printing={printingX}
        showCount={false}
        wishEntries={[]}
        onAddToWishlist={() => {}}
      />,
    );

    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wishlist Chaos Rune" })).toBeInTheDocument();
  });

  it("scopes the stepper to a collection and widens it over siblings", () => {
    render(
      <CardDetailActions
        printing={printingX}
        siblings={[printingX, printingY]}
        collectionId="col-1"
        wishEntries={[]}
        onAddToWishlist={() => {}}
      />,
    );

    const stepper = screen.getByTestId("stepper");
    expect(stepper).toHaveAttribute("data-collection", "col-1");
    expect(stepper).toHaveTextContent("2");
  });

  it("hands the printing to the wishlist callback", async () => {
    const onAddToWishlist = vi.fn();
    render(
      <CardDetailActions printing={printingX} wishEntries={[]} onAddToWishlist={onAddToWishlist} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Wishlist Chaos Rune" }));
    expect(onAddToWishlist).toHaveBeenCalledWith(printingX);
  });
});
