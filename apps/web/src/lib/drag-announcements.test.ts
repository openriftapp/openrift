import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { dragAnnouncements } from "./drag-announcements";

function active(id: string, name?: string): Active {
  return {
    id,
    data: { current: name === undefined ? {} : { name } },
    rect: { current: { initial: null, translated: null } },
  };
}

function over(id: string, name?: string): Over {
  return {
    id,
    data: { current: name === undefined ? {} : { name } },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const announcements = dragAnnouncements({
  item: (drag) => drag.data.current?.name as string | undefined,
  target: (drop) => drop.data.current?.name as string | undefined,
});

const row = active("row-a", "Ionia Vault");

describe("dragAnnouncements", () => {
  it("names the dragged thing and the target it is over and dropped on", () => {
    expect(announcements.onDragStart({ active: row })).toBe("Picked up Ionia Vault.");
    expect(announcements.onDragOver?.({ active: row, over: over("row-b", "Noxus Box") })).toBe(
      "Ionia Vault is over Noxus Box.",
    );
    expect(announcements.onDragEnd({ active: row, over: over("row-b", "Noxus Box") })).toBe(
      "Dropped Ionia Vault on Noxus Box.",
    );
  });

  it("stays quiet over the own slot at pick-up and says when the item is back there", () => {
    announcements.onDragStart({ active: row });
    expect(announcements.onDragOver?.({ active: row, over: over("row-a", "Ionia Vault") })).toBe(
      undefined,
    );

    announcements.onDragOver?.({ active: row, over: over("row-b", "Noxus Box") });
    expect(announcements.onDragOver?.({ active: row, over: over("row-a", "Ionia Vault") })).toBe(
      "Ionia Vault is back in its place.",
    );
    expect(announcements.onDragEnd({ active: row, over: over("row-a", "Ionia Vault") })).toBe(
      "Dropped Ionia Vault. Nothing moved.",
    );
  });

  it("keeps the pick-up until the drag reaches a target, then says when it leaves", () => {
    const unnamed = active("drag-1");
    expect(announcements.onDragStart({ active: unnamed })).toBe("Picked up Item.");
    expect(announcements.onDragOver?.({ active: unnamed, over: over("pool") })).toBe(undefined);

    announcements.onDragOver?.({ active: unnamed, over: over("row-b", "Noxus Box") });
    expect(announcements.onDragOver?.({ active: unnamed, over: null })).toBe(
      "Item is not over a drop area.",
    );
    expect(announcements.onDragCancel({ active: unnamed, over: null })).toBe(
      "Dropped Item. Nothing moved.",
    );
  });
});
