import { sideKey } from "@openrift/shared/printing-side";
import { describe, expect, it } from "vitest";

import type { VRow } from "@/features/cards/lib/card-grid-types";
import { stubCardViewerItem } from "@/test/factories";

import { cardRowIndex } from "./card-row-index";

const first = stubCardViewerItem({ printingId: "p1" });
const second = stubCardViewerItem({ printingId: "p2" });
const rows: VRow[] = [
  { kind: "header", group: { id: "s", slug: "S", name: "Set" }, cardCount: 2 },
  { kind: "cards", items: [first], cardsBefore: 0 },
  { kind: "cards", items: [second], cardsBefore: 1 },
];

describe("cardRowIndex", () => {
  it("finds the row by item id or printing side key", () => {
    expect(cardRowIndex(rows, "p2")).toBe(2);
    expect(cardRowIndex(rows, sideKey(first.printing))).toBe(1);
  });

  it("returns -1 for a card not in the list", () => {
    expect(cardRowIndex(rows, "missing")).toBe(-1);
  });
});
