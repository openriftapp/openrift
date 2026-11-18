import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { tierListDragAnnouncements } from "./tier-list-drag-announcements";

function active(data: Record<string, unknown>): Active {
  return {
    id: "drag-1",
    data: { current: data },
    rect: { current: { initial: null, translated: null } },
  };
}

function over(data: Record<string, unknown>): Over {
  return {
    id: `drop-${String(data.type)}`,
    data: { current: data },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const announcements = tierListDragAnnouncements({
  cardName: (cardId) => ({ c1: "Annie, Fiery", c2: "Lux, Illuminated" })[cardId],
  rowLabel: (rowIndex) => ["S", "A", "B"][rowIndex],
});

describe("tierListDragAnnouncements", () => {
  it("names a pool card and the row it lands in", () => {
    const card = active({ type: "tier-pool-card", cardId: "c1" });
    expect(announcements.onDragStart({ active: card })).toBe("Picked up Annie, Fiery.");
    expect(
      announcements.onDragOver?.({
        active: card,
        over: over({ type: "tier-card", cardId: "c2", rowIndex: 1, position: 0 }),
      }),
    ).toBe("Annie, Fiery is over Row A.");
    expect(
      announcements.onDragEnd({ active: card, over: over({ type: "tier-row", rowIndex: 0 }) }),
    ).toBe("Dropped Annie, Fiery on Row S.");
  });

  it("names the pool only for a card already on the board", () => {
    const pool = over({ type: "tier-pool" });
    expect(
      announcements.onDragEnd({
        active: active({ type: "tier-board-card", cardId: "c2" }),
        over: pool,
      }),
    ).toBe("Dropped Lux, Illuminated on the card pool.");
    expect(
      announcements.onDragEnd({
        active: active({ type: "tier-pool-card", cardId: "c2" }),
        over: pool,
      }),
    ).toBe("Dropped Lux, Illuminated. Nothing moved.");
  });

  it("names a dragged row and only other rows as its targets", () => {
    const row = active({ type: "tier-row-handle", rowIndex: 2 });
    expect(announcements.onDragStart({ active: row })).toBe("Picked up Row B.");
    expect(
      announcements.onDragEnd({ active: row, over: over({ type: "tier-row", rowIndex: 0 }) }),
    ).toBe("Dropped Row B on Row S.");
    expect(
      announcements.onDragEnd({ active: row, over: over({ type: "tier-row", rowIndex: 2 }) }),
    ).toBe("Dropped Row B. Nothing moved.");
  });
});
