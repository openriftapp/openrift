import { describe, expect, it } from "vitest";

import { m } from "@/paraglide/messages.js";

describe("list toolbar count labels", () => {
  it("singularizes a count of 1", () => {
    expect(m.lists_entry_show_cards({ count: 1 })).toBe("Show 1 card");
    expect(m.lists_entry_show_copies({ count: 1 })).toBe("Show 1 copy");
    expect(m.lists_entry_show_printings({ count: 1 })).toBe("Show 1 printing");
  });

  it("pluralizes other counts", () => {
    expect(m.lists_entry_show_cards({ count: 2 })).toBe("Show 2 cards");
    expect(m.lists_entry_show_copies({ count: 2 })).toBe("Show 2 copies");
    expect(m.lists_entry_show_printings({ count: 2 })).toBe("Show 2 printings");
  });

  it("pluralizes the shared card count labels", () => {
    expect(m.collections_grid_show_cards({ count: 1 })).toBe("Show 1 card");
    expect(m.collections_grid_show_cards({ count: 2 })).toBe("Show 2 cards");
    expect(m.cards_grid_show_n_cards({ count: 1 })).toBe("Show 1 card");
    expect(m.cards_grid_show_n_cards({ count: 2 })).toBe("Show 2 cards");
    expect(m.collections_drag_cards_plural({ count: 1 })).toBe("1 card");
    expect(m.collections_drag_cards_plural({ count: 2 })).toBe("2 cards");
  });
});
