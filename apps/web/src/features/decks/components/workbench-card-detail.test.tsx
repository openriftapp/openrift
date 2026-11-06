import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectionStore } from "@/stores/selection-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Jinx" } });

vi.mock("@/features/cards/components/card-detail/card-detail", () => ({
  CardDetail: () => <div>detail body</div>,
}));
vi.mock("@/features/cards/hooks/use-overlay-history-entry", () => ({
  useOverlayHistoryEntry: () => {},
  closeOverlayHistoryEntry: (_key: string, close: () => void) => close(),
}));
vi.mock("@/features/cards/hooks/use-selection-detail", () => ({
  useSelectionDetail: () => ({
    selectedCard: printing,
    siblingPrintings: [],
    navLabel: "",
  }),
}));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));

const { WorkbenchCardDetail } = await import("./workbench-card-detail");

const resetStore = createStoreResetter(useSelectionStore);

describe("WorkbenchCardDetail", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("closes from the corner button", () => {
    useSelectionStore.getState().selectCard(printing, [{ id: "p1", printing }], "card");
    render(
      <WorkbenchCardDetail
        items={[]}
        printingsByCardId={new Map()}
        showImages={false}
        onSearchAndClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close card details" }));

    expect(useSelectionStore.getState().detailOpen).toBe(false);
  });
});
