// @vitest-environment happy-dom
import type {
  ClientRect,
  CollisionDetection,
  DroppableContainer,
  KeyboardSensorProps,
  SensorContext,
} from "@dnd-kit/core";
import { sleep } from "@openrift/shared/async";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptsReorderDrop,
  collectionCollisionDetection,
  SidebarReorderKeyboardSensor,
} from "./collection-dnd-sensing";

const binderRow = { type: "sidebar-reorder-collection", collectionId: "c1" } as const;
const wishlistRow = { type: "sidebar-reorder-list", listId: "l1", intent: "wish" } as const;

describe("acceptsReorderDrop", () => {
  it("accepts a reorder drag from the same section", () => {
    expect(
      acceptsReorderDrop(binderRow, { type: "sidebar-reorder-collection", collectionId: "c2" }),
    ).toBe(true);
    expect(
      acceptsReorderDrop(wishlistRow, {
        type: "sidebar-reorder-list",
        listId: "l2",
        intent: "wish",
      }),
    ).toBe(true);
  });

  it("rejects a reorder drag from another section", () => {
    expect(
      acceptsReorderDrop(binderRow, {
        type: "sidebar-reorder-list",
        listId: "l2",
        intent: "wish",
      }),
    ).toBe(false);
    expect(
      acceptsReorderDrop(wishlistRow, { type: "sidebar-reorder-collection", collectionId: "c2" }),
    ).toBe(false);
    expect(
      acceptsReorderDrop(wishlistRow, {
        type: "sidebar-reorder-list",
        listId: "l2",
        intent: "trade",
      }),
    ).toBe(false);
  });

  it("rejects card drags and no drag", () => {
    expect(acceptsReorderDrop(binderRow, { type: "collection-card" })).toBe(false);
    expect(acceptsReorderDrop(binderRow, undefined)).toBe(false);
  });
});

function rect(top: number): ClientRect {
  return { top, left: 0, width: 100, height: 20, bottom: top + 20, right: 100 };
}

function container(id: string): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: {} },
    disabled: false,
    node: { current: null },
    rect: { current: null },
  };
}

const args: Parameters<CollisionDetection>[0] = {
  active: {
    id: "a",
    data: { current: {} },
    rect: { current: { initial: null, translated: null } },
  },
  collisionRect: rect(0),
  droppableRects: new Map([
    ["top", rect(0)],
    ["far", rect(200)],
  ]),
  droppableContainers: [container("top"), container("far")],
  pointerCoordinates: null,
};

describe("collectionCollisionDetection", () => {
  it("lands a pointerless drag on the closest droppable", () => {
    expect(collectionCollisionDetection(args)[0]?.id).toBe("top");
  });

  it("lands a pointer drag only on the droppable under the pointer", () => {
    const collisions = collectionCollisionDetection({
      ...args,
      pointerCoordinates: { x: 50, y: 210 },
    });

    expect(collisions.map((collision) => collision.id)).toEqual(["far"]);
  });

  it("finds nothing when the pointer is over no droppable", () => {
    expect(
      collectionCollisionDetection({ ...args, pointerCoordinates: { x: 50, y: 100 } }),
    ).toEqual([]);
  });
});

function keydown(code: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true });
}

// The sidebar is sticky: scrolling the page leaves its rows where they are, so the
// drag has to move even when the page could scroll toward the target row.
function startSensor() {
  const page = document.documentElement;
  page.scrollTop = 100;
  const scrollTo = vi.spyOn(page, "scrollTo").mockImplementation(() => {});
  const grip = document.createElement("button");
  document.body.append(grip);
  const activation = keydown("Space");
  grip.dispatchEvent(activation);
  const props = {
    active: "row-2",
    activeNode: {
      id: "row-2",
      key: "row-2",
      node: { current: grip },
      activatorNode: { current: grip },
      data: { current: {} },
    },
    event: activation,
    context: {
      current: { collisionRect: rect(40), scrollableAncestors: [page] } as unknown as SensorContext,
    },
    options: {
      coordinateGetter: (event: KeyboardEvent) =>
        event.code === "ArrowUp" ? { x: 0, y: 20 } : undefined,
    },
    onAbort: vi.fn(),
    onPending: vi.fn(),
    onStart: vi.fn(),
    onCancel: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
  } satisfies KeyboardSensorProps;
  const sensor = new SidebarReorderKeyboardSensor(props);
  return { props, scrollTo, sensor };
}

async function press(code: string) {
  await sleep(0);
  document.dispatchEvent(keydown(code));
}

describe("SidebarReorderKeyboardSensor", () => {
  afterEach(() => {
    document.documentElement.scrollTop = 0;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("moves up to the target row with the page scrolled, and leaves the page where it is", async () => {
    const { props, scrollTo } = startSensor();

    await press("ArrowUp");

    expect(props.onMove).toHaveBeenCalledWith({ x: 0, y: -20 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("starts at the drag origin and ends on Space", async () => {
    const { props } = startSensor();

    await press("Space");

    expect(props.onStart).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(props.onEnd).toHaveBeenCalledOnce();
  });

  it("does not end the drag on the Space press that started it", async () => {
    const { props } = startSensor();

    document.dispatchEvent(props.event);
    await press("ArrowUp");

    expect(props.onEnd).not.toHaveBeenCalled();
    expect(props.onMove).toHaveBeenCalledOnce();
  });

  it("cancels on Escape and stops listening", async () => {
    const { props } = startSensor();

    await press("Escape");
    await press("ArrowUp");

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onMove).not.toHaveBeenCalled();
  });

  it("does not move when the coordinate getter finds no target", async () => {
    const { props } = startSensor();

    await press("ArrowDown");

    expect(props.onMove).not.toHaveBeenCalled();
    expect(props.onEnd).not.toHaveBeenCalled();
  });
});
