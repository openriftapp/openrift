import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ListEntryDragData } from "@/features/collections/lib/dnd-types";
import { stubPrinting } from "@/test/factories";

import { DraggableListEntry } from "./draggable-list-entry";

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

function renderEntry() {
  const printing = stubPrinting();
  const data: ListEntryDragData = {
    type: "list-entry",
    selectionIds: ["e1"],
    entryIds: ["e1"],
    copyIds: [],
    fromSelection: false,
    sourceListId: "list-1",
    sourceKind: "card",
    sourceIntent: "wish",
    totalQuantity: 1,
    printing,
    previewPrintings: [printing],
    cardName: "Jinx",
  };
  return render(
    <DndContext>
      <button type="button">Before</button>
      <DraggableListEntry id="entry-1" data={data}>
        <button type="button">Open card</button>
      </DraggableListEntry>
    </DndContext>,
  );
}

describe("DraggableListEntry", () => {
  it("tabs straight from the previous control to the tile's own button", async () => {
    const user = userEvent.setup();
    renderEntry();

    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();

    expect(screen.getByRole("button", { name: "Open card" })).toHaveFocus();
  });

  it("gives the drag wrapper no button role of its own", () => {
    renderEntry();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Before",
      "Open card",
    ]);
  });
});
