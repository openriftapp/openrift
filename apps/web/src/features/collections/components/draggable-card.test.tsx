import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

import { DraggableCard } from "./draggable-card";

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

function renderCard() {
  const printing = stubPrinting();
  return render(
    <DndContext>
      <button type="button">Before</button>
      <DraggableCard
        id="tile-1"
        copyIds={["c1"]}
        fromSelection={false}
        isStackDrag={false}
        printing={printing}
        previewPrintings={[printing]}
        sourceCollectionId="col-1"
        sourceAllGroupCopies={false}
      >
        <button type="button">Open card</button>
      </DraggableCard>
    </DndContext>,
  );
}

describe("DraggableCard", () => {
  it("tabs straight from the previous control to the tile's own button", async () => {
    const user = userEvent.setup();
    renderCard();

    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();

    expect(screen.getByRole("button", { name: "Open card" })).toHaveFocus();
  });

  it("gives the drag wrapper no button role of its own", () => {
    renderCard();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Before",
      "Open card",
    ]);
  });
});
