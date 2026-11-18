import type { Card, Printing } from "@openrift/shared/types/catalog";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTierListBuilderStore } from "@/features/stage/stores/tier-list-builder-store";
import { m } from "@/paraglide/messages.js";
import { stubCard } from "@/test/factories";

import { TierBoardEditor } from "./tier-board-editor";

const cardsById: Record<string, Card> = { "card-a": stubCard({ name: "Ekko" }) };
const printingsByCardId = new Map<string, Printing[]>();

vi.mock("@/features/cards/hooks/use-printing-choices", () => ({
  usePrintingChoices: () => [],
}));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: undefined }) }));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCountsForPrintings: () => ({ data: undefined }),
}));

beforeEach(() => {
  useTierListBuilderStore
    .getState()
    .adopt("list-1", [{ label: "S", cards: [{ cardId: "card-a", printingId: null }] }]);
});

afterEach(() => {
  useTierListBuilderStore.getState().reset();
});

describe("TierBoardEditor", () => {
  it("lets a keyboard user focus a ranked card and open its menu", () => {
    render(
      <TierBoardEditor
        cardsById={cardsById}
        printingsByCardId={printingsByCardId}
        tapToAssign={false}
      />,
    );

    const tile = screen.getByLabelText("Ekko");
    expect(tile).toHaveAttribute("aria-haspopup", "menu");
    tile.focus();
    expect(tile).toHaveFocus();

    fireEvent.contextMenu(tile);
    expect(screen.getByRole("menuitem", { name: m.tier_lists_unrank_card() })).toBeInTheDocument();
  });
});
