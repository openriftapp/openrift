import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, useDraggable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { useCollectionDndSensors } from "@/features/collections/hooks/use-collection-dnd-sensors";
import { collectionCollisionDetection } from "@/features/collections/lib/collection-dnd-sensing";

import { SortableSidebarRow } from "./sortable-sidebar-row";

/**
 * The onTouchStart spy stands in for Base UI's ContextMenuTrigger, which
 * starts its long-press timer from a React onTouchStart on an ancestor of the grip.
 */
function renderRow() {
  const onTouchStart = vi.fn();
  render(
    <DndContext>
      <div onTouchStart={onTouchStart}>
        <SortableSidebarRow
          id="sortable-collection-c1"
          data={{ type: "sidebar-reorder-collection", collectionId: "c1" }}
          label="Binder"
        >
          {(handle) => <div>{handle}</div>}
        </SortableSidebarRow>
      </div>
    </DndContext>,
  );
  return onTouchStart;
}

describe("SortableSidebarRow", () => {
  it("keeps a touch on the grip away from the row's context-menu trigger", () => {
    const onTouchStart = renderRow();

    fireEvent.touchStart(screen.getByRole("button", { name: "Reorder Binder" }), {
      touches: [{ clientX: 10, clientY: 10 }],
    });

    expect(onTouchStart).not.toHaveBeenCalled();
  });

  it("still lets a touch elsewhere in the row reach the context-menu trigger", () => {
    const onTouchStart = renderRow();

    fireEvent.touchStart(screen.getByRole("button", { name: "Reorder Binder" }).parentElement!, {
      touches: [{ clientX: 10, clientY: 10 }],
    });

    expect(onTouchStart).toHaveBeenCalledTimes(1);
  });

  it("opts the grip out of browser panning so the drag survives the first move", () => {
    renderRow();

    expect(screen.getByRole("button", { name: "Reorder Binder" })).toHaveClass("touch-none");
  });
});

const ROW_HEIGHT = 32;

function rowRect(index: number): DOMRect {
  const top = index * ROW_HEIGHT;
  return {
    top,
    bottom: top + ROW_HEIGHT,
    left: 0,
    right: 200,
    width: 200,
    height: ROW_HEIGHT,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

const BINDERS = ["Binder One", "Binder Two", "Binder Three"];

function CardTile() {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: "copy-1",
    data: { type: "collection-card" },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} data-row={5}>
      <Button>Add one</Button>
    </div>
  );
}

function ReorderHarness({ onDragEnd }: { onDragEnd: (event: DragEndEvent) => void }) {
  const sensors = useCollectionDndSensors();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collectionCollisionDetection}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={BINDERS.map((_, index) => `sortable-collection-c${index}`)}
        strategy={verticalListSortingStrategy}
      >
        {BINDERS.map((label, index) => (
          <SortableSidebarRow
            key={label}
            id={`sortable-collection-c${index}`}
            data={{ type: "sidebar-reorder-collection", collectionId: `c${index}` }}
            label={label}
          >
            {(handle) => <div data-row={index}>{handle}</div>}
          </SortableSidebarRow>
        ))}
      </SortableContext>
      <CardTile />
    </DndContext>
  );
}

describe("SortableSidebarRow keyboard reorder", () => {
  const originalRect = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function getRect(this: Element) {
      const row = this.closest("[data-row]") ?? this.querySelector("[data-row]");
      return row ? rowRect(Number((row as HTMLElement).dataset.row)) : originalRect.call(this);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
  });

  it("moves a row up with Space, ArrowUp, Space", async () => {
    const user = userEvent.setup();
    const onDragEnd = vi.fn();
    render(<ReorderHarness onDragEnd={onDragEnd} />);

    screen.getByRole("button", { name: "Reorder Binder Two" }).focus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowUp}");
    await user.keyboard(" ");

    expect(onDragEnd).toHaveBeenCalledOnce();
    const event = onDragEnd.mock.calls[0]![0] as DragEndEvent;
    expect(event.active.id).toBe("sortable-collection-c1");
    expect(event.over?.id).toBe("sortable-collection-c0");
  });

  it("leaves Enter on a card tile's buttons to the button", async () => {
    const user = userEvent.setup();
    const onDragEnd = vi.fn();
    render(<ReorderHarness onDragEnd={onDragEnd} />);

    // The draggable wrapper carries role="button" too; the tile's own button is the inner one.
    screen.getAllByRole("button", { name: "Add one" }).at(-1)!.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");

    expect(onDragEnd).not.toHaveBeenCalled();
  });
});
