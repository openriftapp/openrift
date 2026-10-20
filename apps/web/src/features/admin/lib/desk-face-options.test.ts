import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { describe, expect, it } from "vitest";

import { deskFaceOptions, deskPrintingName } from "./desk-face-options";

function row(side: 1 | 2, secondSide: { cardName: string } | null): DeskPrintingRow {
  return { cardName: "Bird", side, secondSide } as DeskPrintingRow;
}

describe("deskFaceOptions", () => {
  it("offers one group for a single-sided printing", () => {
    expect(deskFaceOptions(row(1, null))).toEqual([{ value: "front", label: "Images" }]);
  });

  it("names each side by its card when the printing is shown from side 1", () => {
    expect(deskFaceOptions(row(1, { cardName: "Gold" })).map((option) => option.label)).toEqual([
      "Bird's side",
      "Gold's side",
    ]);
  });

  it("keeps side 1's card first when the printing is shown from side 2", () => {
    expect(deskFaceOptions(row(2, { cardName: "Gold" })).map((option) => option.label)).toEqual([
      "Gold's side",
      "Bird's side",
    ]);
  });
});

describe("deskPrintingName", () => {
  it("names both cards, side 1 first, from either side", () => {
    expect(deskPrintingName(row(1, { cardName: "Gold" }))).toBe("Bird // Gold");
    expect(deskPrintingName(row(2, { cardName: "Gold" }))).toBe("Gold // Bird");
    expect(deskPrintingName(row(1, null))).toBe("Bird");
  });
});
