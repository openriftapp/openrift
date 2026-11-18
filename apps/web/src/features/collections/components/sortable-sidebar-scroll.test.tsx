// @vitest-environment jsdom
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useCollectionDndSensors } from "@/features/collections/hooks/use-collection-dnd-sensors";
import { collectionCollisionDetection } from "@/features/collections/lib/collection-dnd-sensing";

import { SortableSidebarRow } from "./sortable-sidebar-row";

const ROW_HEIGHT = 32;
const BINDERS = ["Binder One", "Binder Two", "Binder Three"];

function Harness({ onDragEnd }: { onDragEnd: (event: DragEndEvent) => void }) {
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
            data={{ type: "sidebar-reorder-collection", collectionId: `c${index}`, label }}
          >
            {(handle) => <div data-row={index}>{handle}</div>}
          </SortableSidebarRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

const originalRect = Element.prototype.getBoundingClientRect;
const page = document.documentElement;

// The page is scrolled while the rows keep their viewport rects, as in the sticky sidebar.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function getRect(this: Element) {
    const row = this.closest("[data-row]") ?? this.querySelector("[data-row]");
    if (!row) {
      return originalRect.call(this);
    }
    const top = Number((row as HTMLElement).dataset.row) * ROW_HEIGHT;
    return DOMRect.fromRect({ x: 0, y: top, width: 200, height: ROW_HEIGHT });
  };
  Object.defineProperty(document, "scrollingElement", { value: page, configurable: true });
  page.scrollTop = 100;
  Object.defineProperty(page, "scrollTop", { value: 100, configurable: true, writable: true });
  Object.defineProperty(page, "scrollHeight", { value: 3000, configurable: true });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  Reflect.deleteProperty(document, "scrollingElement");
  Reflect.deleteProperty(page, "scrollTop");
  Reflect.deleteProperty(page, "scrollHeight");
});

it("moves a sidebar row up with Space, ArrowUp, Space while the page is scrolled", async () => {
  const scrollTo = vi.fn();
  page.scrollTo = scrollTo;
  const user = userEvent.setup();
  const onDragEnd = vi.fn();
  render(<Harness onDragEnd={onDragEnd} />);

  screen.getByRole("button", { name: "Reorder Binder Two" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{ArrowUp}");
  await user.keyboard(" ");

  expect(scrollTo).not.toHaveBeenCalled();
  const event = onDragEnd.mock.calls[0]![0] as DragEndEvent;
  expect(event.over?.id).toBe("sortable-collection-c0");
});
