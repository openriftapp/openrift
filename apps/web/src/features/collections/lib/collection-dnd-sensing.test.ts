import type { ClientRect, CollisionDetection, DroppableContainer } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { acceptsReorderDrop, collectionCollisionDetection } from "./collection-dnd-sensing";

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
