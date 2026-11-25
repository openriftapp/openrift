import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/components/card-search-dropdown", () => ({
  CardSearchDropdown: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect("card-2")}>
      Pick Jinx
    </button>
  ),
}));
vi.mock("@/features/cards/hooks/use-card-search", () => ({ useAdminCardSearch: () => [] }));

const { PickCardDialog } = await import("./pick-card-dialog");

function dialog(open: boolean, onPick = vi.fn()) {
  return (
    <PickCardDialog
      open={open}
      cards={[]}
      pending={false}
      error={null}
      onOpenChange={vi.fn()}
      onPick={onPick}
    />
  );
}

describe("PickCardDialog", () => {
  it("links the card that was picked", () => {
    const onPick = vi.fn();
    render(dialog(true, onPick));

    fireEvent.click(screen.getByRole("button", { name: "Pick Jinx" }));
    fireEvent.click(screen.getByRole("button", { name: "It is this card" }));

    expect(onPick).toHaveBeenCalledWith("card-2");
  });

  it("forgets the earlier pick when it opens again", () => {
    const { rerender } = render(dialog(true));
    fireEvent.click(screen.getByRole("button", { name: "Pick Jinx" }));

    rerender(dialog(false));
    rerender(dialog(true));

    expect(screen.getByRole("button", { name: "It is this card" })).toBeDisabled();
  });
});
