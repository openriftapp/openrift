import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { dragAnnouncements } from "./drag-announcements";

const NAMES = new Map([
  ["p1", "Ashe"],
  ["p2", "Braum"],
]);

function active(playerId: string): Active {
  return {
    id: `player:${playerId}`,
    data: { current: { playerId } },
    rect: { current: { initial: null, translated: null } },
  };
}

function over(playerId: string): Over {
  return {
    id: `target:${playerId}`,
    data: { current: { playerId } },
    rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
    disabled: false,
  };
}

const announcements = dragAnnouncements({
  itemName: (data) => NAMES.get((data as { playerId: string }).playerId),
  targetName: (data) => NAMES.get((data as { playerId: string }).playerId),
  dropped: (name, target) => `${name} -> ${target}`,
});

describe("dragAnnouncements", () => {
  it("names the dragged player and the target instead of their ids", () => {
    expect(announcements.onDragStart({ active: active("p1") })).toBe("Picked up Ashe.");
    expect(announcements.onDragOver({ active: active("p1"), over: over("p2") })).toBe(
      "Ashe is over Braum.",
    );
    expect(announcements.onDragEnd({ active: active("p1"), over: over("p2") })).toBe(
      "Ashe -> Braum",
    );
  });

  it("says nothing moved when the drop has no target or the drag is cancelled", () => {
    expect(announcements.onDragOver({ active: active("p1"), over: null })).toBe(
      "Ashe is not over a drop area.",
    );
    expect(announcements.onDragEnd({ active: active("p1"), over: null })).toBe(
      "Dropped Ashe. Nothing moved.",
    );
    expect(announcements.onDragCancel({ active: active("p1"), over: null })).toBe(
      "Dropped Ashe. Nothing moved.",
    );
  });

  it("falls back to the unknown-player label for a player without a name", () => {
    expect(announcements.onDragStart({ active: active("p9") })).not.toContain("p9");
  });
});
