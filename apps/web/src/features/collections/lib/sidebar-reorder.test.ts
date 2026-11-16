import { describe, expect, it } from "vitest";

import { sidebarReorder } from "./sidebar-reorder";

const row = (id: string, sidebarHidden = false) => ({ id, sidebarHidden });

describe("sidebarReorder", () => {
  it("moves a row below a revealed hidden row it is dropped on", () => {
    // Shown: a, b, then the revealed hidden h.
    const rows = [row("a"), row("h", true), row("b")];

    expect(sidebarReorder(rows, "a", "h")).toEqual(["b", "h", "a"]);
  });

  it("moves a revealed hidden row above the row it is dropped on", () => {
    const rows = [row("a"), row("h", true), row("b")];

    expect(sidebarReorder(rows, "h", "a")).toEqual(["h", "a", "b"]);
  });

  it("returns null for a drop on itself or an unknown row", () => {
    const rows = [row("a"), row("b")];

    expect(sidebarReorder(rows, "a", "a")).toBeNull();
    expect(sidebarReorder(rows, "a", "zz")).toBeNull();
  });
});
