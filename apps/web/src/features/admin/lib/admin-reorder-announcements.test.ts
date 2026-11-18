import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { adminReorderAnnouncements } from "./admin-reorder-announcements";

function row(id: string): Active & Over {
  return {
    id,
    data: { current: {} },
    rect: { current: { initial: null, translated: null } },
    disabled: false,
  } as unknown as Active & Over;
}

const announcements = adminReorderAnnouncements((key) => ({ fury: "Fury", calm: "Calm" })[key]);

describe("adminReorderAnnouncements", () => {
  it("names the dragged row and the row it moves over by their labels", () => {
    expect(announcements.onDragStart({ active: row("fury") })).toBe("Picked up Fury.");
    expect(announcements.onDragOver?.({ active: row("fury"), over: row("calm") })).toBe(
      "Fury is over Calm.",
    );
    expect(announcements.onDragEnd({ active: row("fury"), over: row("calm") })).toBe(
      "Dropped Fury on Calm.",
    );
  });

  it("says when the row is back in its place", () => {
    announcements.onDragStart({ active: row("fury") });
    announcements.onDragOver?.({ active: row("fury"), over: row("calm") });

    expect(announcements.onDragOver?.({ active: row("fury"), over: row("fury") })).toBe(
      "Fury is back in its place.",
    );
  });
});
