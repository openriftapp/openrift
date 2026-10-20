import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { describe, expect, it } from "vitest";

import { deskFaceOptions, deskPrintingCodes, deskPrintingName } from "./desk-face-options";

function row(
  side: 1 | 2,
  secondSide: { cardName: string; publicCode?: string } | null,
): DeskPrintingRow {
  return { cardName: "Bird", publicCode: "SGN-T01", side, secondSide } as DeskPrintingRow;
}

describe("deskPrintingCodes", () => {
  it("lists both faces' codes, face 1 first, from either face", () => {
    const gold = { cardName: "Gold", publicCode: "SGN-T05" };

    expect(deskPrintingCodes(row(1, gold))).toBe("SGN-T01 // SGN-T05");
    expect(deskPrintingCodes(row(2, gold))).toBe("SGN-T05 // SGN-T01");
  });

  it("shows the one code of a single-faced printing", () => {
    expect(deskPrintingCodes(row(1, null))).toBe("SGN-T01");
  });
});

describe("deskFaceOptions", () => {
  it("offers one group for a single-faced printing", () => {
    expect(deskFaceOptions(row(1, null))).toEqual([{ value: "front", label: "Images" }]);
  });

  it("names each side by its card when the printing is shown from side 1", () => {
    expect(deskFaceOptions(row(1, { cardName: "Gold" })).map((option) => option.label)).toEqual([
      "Bird's face",
      "Gold's face",
    ]);
  });

  it("keeps side 1's card first when the printing is shown from side 2", () => {
    expect(deskFaceOptions(row(2, { cardName: "Gold" })).map((option) => option.label)).toEqual([
      "Gold's face",
      "Bird's face",
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
