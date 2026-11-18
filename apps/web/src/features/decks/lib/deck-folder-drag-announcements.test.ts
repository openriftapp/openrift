import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { deckFolderDragAnnouncements } from "./deck-folder-drag-announcements";

function folder(id: string, name: string): Active & Over {
  return {
    id,
    data: { current: { type: "deck-folder", name } },
    rect: { current: { initial: null, translated: null } },
    disabled: false,
  } as unknown as Active & Over;
}

describe("deckFolderDragAnnouncements", () => {
  it("names the folder and the folder it moves over", () => {
    const ranked = folder("f1", "Ranked");
    const casual = folder("f2", "Casual Brews");

    expect(deckFolderDragAnnouncements.onDragStart({ active: ranked })).toBe("Picked up Ranked.");
    expect(deckFolderDragAnnouncements.onDragOver?.({ active: ranked, over: casual })).toBe(
      "Ranked is over Casual Brews.",
    );
    expect(deckFolderDragAnnouncements.onDragEnd({ active: ranked, over: casual })).toBe(
      "Dropped Ranked on Casual Brews.",
    );
  });

  it("says nothing moved when the folder lands back in its own slot", () => {
    const ranked = folder("f1", "Ranked");
    deckFolderDragAnnouncements.onDragStart({ active: ranked });

    expect(deckFolderDragAnnouncements.onDragEnd({ active: ranked, over: ranked })).toBe(
      "Dropped Ranked. Nothing moved.",
    );
  });
});
